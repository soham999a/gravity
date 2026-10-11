import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { CREDIT_PACKS, creditWallet } from "@/lib/billing";
import { isFirebaseReady, adminDb } from "@/lib/firebase-admin";
import { dbAllowed, fs } from "@/lib/db-guard";

export const dynamic = "force-dynamic";

/** Verify a Razorpay payment signature, then credit the wallet + invoice. */
export async function POST(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    paymentId?: string;
    signature?: string;
    pack?: string;
  };
  const pack = CREDIT_PACKS.find((p) => p.id === body.pack);
  if (!pack || !body.orderId || !body.paymentId || !body.signature) {
    return NextResponse.json({ error: "incomplete payment proof" }, { status: 400 });
  }
  if (!process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: "billing not configured" }, { status: 501 });
  }
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${body.orderId}|${body.paymentId}`)
    .digest("hex");
  if (expected !== body.signature) {
    return NextResponse.json({ error: "signature mismatch — payment NOT credited" }, { status: 400 });
  }

  const credits = await creditWallet(ctx.uid, pack.credits);
  try {
    if (isFirebaseReady() && dbAllowed()) {
      await fs(() =>
        adminDb.collection("billing_payments").add({
          uid: ctx.uid,
          pack: pack.id,
          amountInr: pack.inr,
          credits: pack.credits,
          orderId: body.orderId,
          paymentId: body.paymentId,
          at: new Date().toISOString(),
        }),
      );
    }
  } catch {
    /* wallet already credited — invoice best effort */
  }
  return NextResponse.json({ ok: true, credits });
}
