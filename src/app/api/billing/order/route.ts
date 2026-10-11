import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { CREDIT_PACKS } from "@/lib/billing";
import { razorpayConfigured } from "../route";

export const dynamic = "force-dynamic";

/** Create a Razorpay order for a credit pack. Amounts in paise. */
export async function POST(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Top-ups aren't live yet — add your OpenRouter key for unlimited instead." }, { status: 501 });
  }
  const body = (await request.json().catch(() => ({}))) as { pack?: string };
  const pack = CREDIT_PACKS.find((p) => p.id === body.pack);
  if (!pack) return NextResponse.json({ error: "unknown pack" }, { status: 400 });

  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  try {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: pack.inr * 100,
        currency: "INR",
        receipt: `g-${ctx.uid.slice(0, 8)}-${Date.now().toString(36)}`,
        notes: { uid: ctx.uid, pack: pack.id, credits: pack.credits },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: `Razorpay said ${res.status} — try again. ${text.slice(0, 120)}` }, { status: 502 });
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      pack,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach Razorpay — try again." }, { status: 502 });
  }
}
