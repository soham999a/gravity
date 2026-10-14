/**
 * Billing core — BYOK + credit wallet + plans + free caps.
 *
 * Billing order per paid call: BYOK key → wallet credits → free daily quota.
 * - BYOK: user's own OpenRouter key, unlimited, costs us $0.
 * - Wallet: prepaid credits, deducted after successful execution.
 * - Free: capped daily trial on the shared key (abuse-proof by design).
 *
 * Firestore collections: wallets/{uid}, usage_daily/{uid_YYYY-MM-DD},
 * billing_keys/{uid} (encrypted), billing_payments/{autoId}.
 * Degraded mode (Firestore down): in-memory fallback, fail-open for free
 * quota only — wallet/BYOK reads fall back to "absent" (free tier applies).
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { FieldValue } from "firebase-admin/firestore";
import { isFirebaseReady, adminDb } from "@/lib/firebase-admin";
import { dbAllowed, fs } from "@/lib/db-guard";
import { decryptKey } from "./keyvault";

export type BillableKind = "chat" | "mission" | "bench_chunk" | "bench_free" | "refine";

/** Credits charged per successful execution. */
export const CREDIT_COST: Record<BillableKind, number> = {
  chat: 1,
  mission: 5,
  bench_chunk: 5,
  bench_free: 0,
  refine: 2,
};

/** Free daily trial on the shared key. Paid baselines stay paid-only;
 *  the free lane covers GRAVITY-system chunks only (zero provider cost).
 *  Cap fits one full all-systems run (25 combos ≈ 15 small chunks, D/E solo)
 *  + spare for retries. */
export const FREE_DAILY: Record<BillableKind, number> = {
  chat: 5,
  mission: 1,
  bench_chunk: 0,
  bench_free: 20,
  refine: 3,
};

/** Pro multipliers over free caps. */
export const PLANS = {
  free: { label: "Free", priceInr: 0, mult: 1 },
  pro: { label: "Pro", priceInr: 199, mult: 10 },
  pro_plus: { label: "Pro+", priceInr: 799, mult: 40 },
} as const;
export type PlanId = keyof typeof PLANS;

/** Top-up packs (Razorpay). Bonus scales with pack — margin ≈3x cost. */
export const CREDIT_PACKS = [
  { id: "starter", inr: 99, credits: 100 },
  { id: "plus", inr: 499, credits: 550 },
  { id: "scale", inr: 999, credits: 1200 },
] as const;

export const BILLING_PAUSED =
  process.env.BILLING_PAUSED === "1";

// ── Per-request provider-key context (AsyncLocalStorage) ──
// Entry routes wrap execution in runWithKey(resolvedUserKey, fn); the LLM
// layer prefers the active key over env. Zero signature changes in pipeline.

const keyStore = new AsyncLocalStorage<string | undefined>();

export function runWithKey<T>(key: string | undefined, fn: () => T): T {
  return keyStore.run(key, fn);
}

export function activeProviderKey(): string | undefined {
  try {
    return keyStore.getStore();
  } catch {
    return undefined;
  }
}

// ── Firestore access (degraded-aware) ──

function useStore(): boolean {
  try {
    return isFirebaseReady() && dbAllowed();
  } catch {
    return false;
  }
}

const memUsage = new Map<string, Record<BillableKind, number>>();
const memWallets = new Map<string, number>();
const memPlans = new Map<string, { plan: PlanId; expiresAt: string | null }>();

function todayKey(uid: string): string {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${uid}_${day}`;
}

export interface WalletState {
  credits: number;
  plan: PlanId;
  planExpiresAt: string | null;
}

export async function getWalletState(uid: string): Promise<WalletState> {
  const fallback: WalletState = {
    credits: memWallets.get(uid) ?? 0,
    plan: memPlans.get(uid)?.plan ?? "free",
    planExpiresAt: memPlans.get(uid)?.expiresAt ?? null,
  };
  if (!useStore()) return fallback;
  try {
    const [w, u] = await Promise.all([
      fs(() => adminDb.collection("wallets").doc(uid).get()),
      fs(() => adminDb.collection("users").doc(uid).get()),
    ]);
    const credits = typeof w.data()?.credits === "number" ? (w.data()?.credits as number) : fallback.credits;
    const rawPlan = (u.data()?.plan ?? fallback.plan) as string;
    const plan: PlanId = rawPlan === "pro" || rawPlan === "pro_plus" ? rawPlan : "free";
    let planExpiresAt = (u.data()?.planExpiresAt as string | null) ?? null;
    // Expired pro falls back to free automatically.
    if (plan !== "free" && planExpiresAt && Date.parse(planExpiresAt) <= Date.now()) {
      return { credits, plan: "free", planExpiresAt: null };
    }
    return { credits, plan, planExpiresAt };
  } catch {
    return fallback;
  }
}

export async function getDailyUsage(uid: string): Promise<Record<BillableKind, number>> {
  const zero: Record<BillableKind, number> = { chat: 0, mission: 0, bench_chunk: 0, bench_free: 0, refine: 0 };
  const mem = memUsage.get(todayKey(uid));
  if (!useStore()) return mem ?? zero;
  try {
    const doc = await fs(() => adminDb.collection("usage_daily").doc(todayKey(uid)).get());
    const d = doc.data() ?? {};
    return {
      chat: Number(d.chat ?? 0) || 0,
      mission: Number(d.mission ?? 0) || 0,
      bench_chunk: Number(d.bench_chunk ?? 0) || 0,
      bench_free: Number(d.bench_free ?? 0) || 0,
      refine: Number(d.refine ?? 0) || 0,
    };
  } catch {
    return mem ?? zero;
  }
}

/** Resolve the caller's own OpenRouter key (decrypted), if saved. */
export async function getUserProviderKey(uid: string): Promise<string | undefined> {
  if (!useStore()) return undefined;
  try {
    const doc = await fs(() => adminDb.collection("billing_keys").doc(uid).get());
    const enc = doc.data()?.openrouter as string | undefined;
    if (!enc) return undefined;
    return decryptKey(enc);
  } catch {
    return undefined;
  }
}

export type Authz =
  | { ok: true; mode: "byok"; key: string }
  | { ok: true; mode: "wallet" | "free"; key?: undefined }
  | { ok: false; reason: string; code: 402 | 503 };

/**
 * Authorize BEFORE execution. BYOK always passes; wallet needs balance;
 * free tier needs remaining daily quota. Never throws — returns 402/503.
 */
export async function authorize(uid: string, kind: BillableKind): Promise<Authz> {
  const userKey = await getUserProviderKey(uid);
  if (userKey) return { ok: true, mode: "byok", key: userKey };

  if (BILLING_PAUSED) {
    return { ok: false, reason: "Billing paused — add your own OpenRouter key in Settings to continue.", code: 503 };
  }

  const [wallet, usage] = await Promise.all([getWalletState(uid), getDailyUsage(uid)]);
  const cost = CREDIT_COST[kind];
  if (wallet.credits >= cost) return { ok: true, mode: "wallet" };

  const cap = FREE_DAILY[kind] * PLANS[wallet.plan].mult;
  if (usage[kind] < cap) return { ok: true, mode: "free" };

  if (kind === "bench_chunk") {
    return { ok: false, reason: "Benchmarks are paid-only — add your OpenRouter key or top up credits in Settings.", code: 402 };
  }
  return {
    ok: false,
    reason: `Free daily limit reached (${cap}/${cap === 1 ? "use" : "uses"}). Add your OpenRouter key for unlimited, or top up credits.`,
    code: 402,
  };
}

/**
 * Settle AFTER successful execution: wallet deduct OR free-counter bump.
 * BYOK settles nothing (their key, their bill). Best-effort — never throws.
 */
export async function settle(uid: string, kind: BillableKind, mode: "byok" | "wallet" | "free"): Promise<void> {
  if (mode === "byok") return;
  try {
    if (mode === "wallet") {
      const cost = CREDIT_COST[kind];
      if (useStore()) {
        await fs(() =>
          adminDb.runTransaction(async (tx) => {
            const ref = adminDb.collection("wallets").doc(uid);
            const snap = await tx.get(ref);
            const bal = typeof snap.data()?.credits === "number" ? (snap.data()?.credits as number) : 0;
            tx.set(ref, { credits: Math.max(0, bal - cost), updatedAt: new Date().toISOString() }, { merge: true });
          }),
        );
      } else {
        memWallets.set(uid, Math.max(0, (memWallets.get(uid) ?? 0) - cost));
      }
      return;
    }
    if (useStore()) {
      await fs(() =>
        adminDb.collection("usage_daily").doc(todayKey(uid)).set(
          { [kind]: FieldValue.increment(1), updatedAt: new Date().toISOString() },
          { merge: true },
        ),
      );
    }
    const key = todayKey(uid);
    const cur = memUsage.get(key) ?? { chat: 0, mission: 0, bench_chunk: 0, bench_free: 0, refine: 0 };
    cur[kind] += 1;
    memUsage.set(key, cur);
  } catch {
    /* billing must never break execution */
  }
}

/** Credit a wallet (verified payments only). */
export async function creditWallet(uid: string, credits: number): Promise<number> {
  if (useStore()) {
    try {
      let balance = 0;
      await fs(() =>
        adminDb.runTransaction(async (tx) => {
          const ref = adminDb.collection("wallets").doc(uid);
          const snap = await tx.get(ref);
          balance = (typeof snap.data()?.credits === "number" ? (snap.data()?.credits as number) : 0) + credits;
          tx.set(ref, { credits: balance, updatedAt: new Date().toISOString() }, { merge: true });
        }),
      );
      return balance;
    } catch {
      /* fall through to mem */
    }
  }
  const balance = (memWallets.get(uid) ?? 0) + credits;
  memWallets.set(uid, balance);
  return balance;
}

/** Set plan (verified subscription only). */
export async function setPlan(uid: string, plan: PlanId, expiresAt: string | null): Promise<void> {
  memPlans.set(uid, { plan, expiresAt });
  if (!useStore()) return;
  try {
    await fs(() =>
      adminDb.collection("users").doc(uid).set({ plan, planExpiresAt: expiresAt }, { merge: true }),
    );
  } catch {
    /* degraded — mem holds it */
  }
}
