import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { CREDIT_PACKS, PLANS, getDailyUsage, getWalletState } from "@/lib/billing";
import { isFirebaseReady, adminDb } from "@/lib/firebase-admin";
import { dbAllowed, fs } from "@/lib/db-guard";

export const dynamic = "force-dynamic";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** Billing state for Settings: wallet, plan, usage, key presence, packs, invoices. */
export async function GET(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [wallet, usage] = await Promise.all([getWalletState(ctx.uid), getDailyUsage(ctx.uid)]);
  let hasKey = false;
  let masked: string | null = null;
  try {
    if (isFirebaseReady() && dbAllowed()) {
      const doc = await fs(() => adminDb.collection("billing_keys").doc(ctx.uid).get());
      masked = (doc.data()?.masked as string | undefined) ?? null;
      hasKey = Boolean(masked);
    }
  } catch {
    /* degraded */
  }

  let invoices: { id: string; pack: string; amountInr: number; credits: number; at: string }[] = [];
  try {
    if (isFirebaseReady() && dbAllowed()) {
      const snap = await fs(() =>
        adminDb.collection("billing_payments").where("uid", "==", ctx.uid).limit(20).get(),
      );
      invoices = snap.docs.map((d) => {
        const v = d.data() as Record<string, string | number>;
        return {
          id: d.id,
          pack: String(v.pack ?? ""),
          amountInr: Number(v.amountInr ?? 0),
          credits: Number(v.credits ?? 0),
          at: String(v.at ?? ""),
        };
      });
    }
  } catch {
    /* degraded */
  }

  // Never expose the key itself — only the masked fingerprint saved at upload.
  return NextResponse.json({
    credits: wallet.credits,
    plan: wallet.plan,
    planExpiresAt: wallet.planExpiresAt,
    plans: PLANS,
    usage,
    hasKey,
    masked,
    packs: CREDIT_PACKS,
    invoices,
    razorpayConfigured: razorpayConfigured(),
    razorpayKeyId: razorpayConfigured() ? process.env.RAZORPAY_KEY_ID : null,
  });
}
