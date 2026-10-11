import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { setPlan, type PlanId } from "@/lib/billing";
import { isFirebaseReady, adminDb } from "@/lib/firebase-admin";
import { dbAllowed, fs } from "@/lib/db-guard";

export const dynamic = "force-dynamic";

/** Confirm a subscription: fetch live status from Razorpay, activate on active. */
export async function POST(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { subscriptionId?: string; plan?: string };
  if (!body.subscriptionId || (body.plan !== "pro" && body.plan !== "pro_plus")) {
    return NextResponse.json({ error: "incomplete proof" }, { status: 400 });
  }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: "billing not configured" }, { status: 501 });
  }
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(body.subscriptionId)}`,
      { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return NextResponse.json({ error: "could not confirm with Razorpay" }, { status: 502 });
    const sub = (await res.json()) as { status?: string; current_end?: number };
    if (sub.status !== "active" && sub.status !== "authenticated") {
      return NextResponse.json({ error: `subscription is ${sub.status ?? "unknown"} — not activated` }, { status: 400 });
    }
    const expiresAt = sub.current_end
      ? new Date(sub.current_end * 1000).toISOString()
      : new Date(Date.now() + 30 * 86400_000).toISOString();
    await setPlan(ctx.uid, body.plan as PlanId, expiresAt);
    try {
      if (isFirebaseReady() && dbAllowed()) {
        await fs(() =>
          adminDb.collection("billing_payments").add({
            uid: ctx.uid,
            pack: `sub-${body.plan}`,
            amountInr: 0,
            credits: 0,
            orderId: body.subscriptionId,
            paymentId: "subscription",
            at: new Date().toISOString(),
          }),
        );
      }
    } catch {
      /* plan already set */
    }
    return NextResponse.json({ ok: true, plan: body.plan, expiresAt });
  } catch {
    return NextResponse.json({ error: "Could not reach Razorpay — try again." }, { status: 502 });
  }
}
