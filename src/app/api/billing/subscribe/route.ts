import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { PLANS, setPlan, type PlanId } from "@/lib/billing";
import { razorpayConfigured } from "../route";

export const dynamic = "force-dynamic";

function planIdFor(plan: PlanId): string | undefined {
  if (plan === "pro") return process.env.RAZORPAY_PRO_PLAN_ID;
  if (plan === "pro_plus") return process.env.RAZORPAY_PROPLUS_PLAN_ID;
  return undefined;
}

/** Create a Razorpay subscription for Pro / Pro+. Client completes checkout,
 *  then POSTs the subscription id to /api/billing/subscribe/confirm. */
export async function POST(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Subscriptions aren't live yet — top-ups and BYOK work today." }, { status: 501 });
  }
  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  const plan = (body.plan === "pro" || body.plan === "pro_plus" ? body.plan : null) as PlanId | null;
  if (!plan) return NextResponse.json({ error: "unknown plan" }, { status: 400 });
  const razorPlanId = planIdFor(plan);
  if (!razorPlanId) {
    return NextResponse.json({ error: `${PLANS[plan].label} plan id not configured yet.` }, { status: 501 });
  }
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  try {
    const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: razorPlanId,
        total_count: 12,
        notes: { uid: ctx.uid, plan },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return NextResponse.json({ error: `Razorpay said ${res.status} — try again.` }, { status: 502 });
    const sub = (await res.json()) as { id: string };
    return NextResponse.json({ subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID, plan });
  } catch {
    return NextResponse.json({ error: "Could not reach Razorpay — try again." }, { status: 502 });
  }
}

/** Dev backdoor (no Razorpay needed): activate a plan locally for testing.
 *  Requires ALLOW_UNSAFE_AUTH=1 AND non-production — never wired in prod. */
export async function PUT(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (process.env.ALLOW_UNSAFE_AUTH !== "1" || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  if (body.plan !== "pro" && body.plan !== "pro_plus") {
    return NextResponse.json({ error: "unknown plan" }, { status: 400 });
  }
  await setPlan(ctx.uid, body.plan, new Date(Date.now() + 30 * 86400_000).toISOString());
  return NextResponse.json({ ok: true, plan: body.plan });
}
