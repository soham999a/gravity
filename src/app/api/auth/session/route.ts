import { NextResponse } from "next/server";
import { adminAuth, isFirebaseReady } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function decodeUnsafe(token: string): { uid: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64url").toString("utf-8"),
    );
    if (!payload.sub || typeof payload.sub !== "string") return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return { uid: payload.sub };
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/session { idToken }
 * Verifies the Firebase ID token server-side and sets an HttpOnly fb-token cookie.
 * In production we REQUIRE Firebase Admin verification. In dev (no Admin creds)
 * we allow unsafe decode so localhost still works without service-account keys.
 */
export async function POST(request: Request) {
  let idToken: string | null = null;
  try {
    const body = (await request.json()) as { idToken?: unknown };
    idToken = typeof body.idToken === "string" ? body.idToken : null;
  } catch {
    idToken = null;
  }
  if (!idToken || idToken.length < 10) {
    return NextResponse.json({ error: "idToken required" }, { status: 400 });
  }

  const isProd = process.env.NODE_ENV === "production";

  if (isFirebaseReady()) {
    try {
      await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }
  } else if (isProd) {
    // Fail closed in production: no Admin creds = no sessions.
    return NextResponse.json({ error: "auth not configured" }, { status: 503 });
  } else {
    // Dev convenience only.
    if (!decodeUnsafe(idToken)) {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }
  }

  const secure = new URL(request.url).protocol === "https:" || isProd;
  const res = NextResponse.json({ ok: true });
  res.cookies.set("fb-token", idToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  return res;
}
