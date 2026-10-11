import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { encryptKey, maskKey } from "@/lib/keyvault";
import { isFirebaseReady, adminDb } from "@/lib/firebase-admin";
import { dbAllowed, fs } from "@/lib/db-guard";

export const dynamic = "force-dynamic";

/** Validate an OpenRouter key without spending: /auth/key only reports quota. */
async function validateOpenRouterKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "OpenRouter rejected this key (401). Check for typos." };
    if (!res.ok) return { ok: false, error: `OpenRouter said ${res.status} — try again.` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach OpenRouter — try again." };
  }
}

/** Save (encrypted) the user's own OpenRouter key after live validation. */
export async function POST(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isFirebaseReady() || !dbAllowed()) {
    return NextResponse.json({ error: "storage unavailable — try again in a minute" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { key?: string };
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key.startsWith("sk-or-") || key.length < 20) {
    return NextResponse.json({ error: "That doesn't look like an OpenRouter key (sk-or-…)." }, { status: 400 });
  }
  const check = await validateOpenRouterKey(key);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  let enc: string;
  try {
    enc = encryptKey(key);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "vault unavailable" }, { status: 503 });
  }
  // The plaintext key never touches logs, responses, or client state.
  await fs(() =>
    adminDb.collection("billing_keys").doc(ctx.uid).set(
      { openrouter: enc, masked: maskKey(key), updatedAt: new Date().toISOString() },
      { merge: true },
    ),
  );
  return NextResponse.json({ ok: true, masked: maskKey(key) });
}

/** Remove the saved key (calls fall back to shared key + free quota). */
export async function DELETE(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    if (isFirebaseReady() && dbAllowed()) {
      await fs(() => adminDb.collection("billing_keys").doc(ctx.uid).delete());
    }
  } catch {
    /* best effort */
  }
  return NextResponse.json({ ok: true });
}
