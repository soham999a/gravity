"use client";

import * as React from "react";
import { onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useGravityUser } from "@/lib/gravity-user";
import { useMissionFeed } from "@/lib/gravity-missions";
import { toast } from "@/components/studio/toast";
import {
  Check,
  CreditCard,
  Download,
  LoaderCircle,
  Mail,
  RotateCcw,
  Send,
  Shield,
  Trash2,
  User,
} from "lucide-react";

type Tab = "profile" | "billing" | "preferences" | "security";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <User className="size-3.5" /> },
  { id: "billing", label: "Plan & billing", icon: <CreditCard className="size-3.5" /> },
  { id: "preferences", label: "Preferences", icon: <RotateCcw className="size-3.5" /> },
  { id: "security", label: "Security", icon: <Shield className="size-3.5" /> },
];

const ROLES = [
  { value: "", label: "Choose a role…" },
  { value: "founder", label: "Founder / Builder" },
  { value: "ops", label: "Operations lead" },
  { value: "analyst", label: "Analyst / Researcher" },
  { value: "engineer", label: "Engineer" },
  { value: "creative", label: "Creative / Marketing" },
  { value: "other", label: "Something else" },
];

const FREE_LIMIT = 250_000;
const PLANS = [
  {
    id: "free",
    name: "FREE",
    tagline: "A daily taste on the shared key.",
    price: "₹0",
    period: "FOREVER",
    features: [
      "5 chats / day",
      "1 mission / day",
      "Community support",
    ],
    cta: "Current plan",
    current: true,
  },
  {
    id: "pro",
    name: "PRO",
    tagline: "10× daily caps for regulars. ₹199/mo.",
    price: "₹199",
    period: "PER MONTH",
    features: [
      "50 chats / day",
      "10 missions / day",
      "Wallet top-ups",
      "Email support",
    ],
    cta: "Upgrade",
    current: false,
  },
  {
    id: "pro_plus",
    name: "PRO+",
    tagline: "40× caps for operators. ₹799/mo.",
    price: "₹799",
    period: "PER MONTH",
    features: [
      "200 chats / day",
      "40 missions / day",
      "Benchmarks included via wallet",
      "Priority support",
    ],
    cta: "Upgrade",
    current: false,
  },
];

interface Usage {
  total: number | null;
  month: number | null;
}

export default function SettingsPage() {
  const [tab, setTab] = React.useState<Tab>("profile");
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [createdAt, setCreatedAt] = React.useState<string | null>(null);
  const { missions, loading } = useMissionFeed();

  const usage = React.useMemo<Usage>(() => {
    if (loading) return { total: null, month: null };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const total = missions.reduce((sum, m) => sum + (m.totalTokens ?? 0), 0);
    const monthly = missions
      .filter((m) => new Date(m.createdAt).getTime() >= monthStart)
      .reduce((sum, m) => sum + (m.totalTokens ?? 0), 0);
    return { total, month: monthly };
  }, [missions, loading]);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUserEmail(u.email ?? null);
        setCreatedAt(u.metadata.creationTime ?? null);
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="studio-page">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="studio-eyebrow">SETTINGS</p>
          <h1 className="studio-page-title mt-3">Account & studio.</h1>
        </div>
        <p className="studio-muted max-w-xs">
          Your identity, plan, and how GRAVITY behaves around you.
        </p>
      </div>

      <div className="studio-settings mt-12">
        <nav className="studio-settings-nav" aria-label="Settings sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={`studio-settings-tab ${tab === item.id ? "studio-settings-tab-active" : ""}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="studio-settings-content">
          {tab === "profile" ? (
            <ProfileTab email={userEmail} createdAt={createdAt} />
          ) : null}
          {tab === "billing" ? <BillingTab usage={usage} /> : null}
          {tab === "preferences" ? <PreferencesTab email={userEmail} /> : null}
          {tab === "security" ? <SecurityTab email={userEmail} /> : null}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ email, createdAt }: { email: string | null; createdAt: string | null }) {
  const user = useGravityUser();
  const [name, setName] = React.useState(user.name ?? "");
  const [role, setRole] = React.useState(user.role ?? "");
  const [saving, setSaving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setName(user.name);
      setRole(user.role);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user.name, user.role]);

  const initials = (name || email || "G").slice(0, 2).toUpperCase();
  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  const save = () => {
    setSaving(true);
    user.update({ name: name.trim() || "GRAVITY user", role });
    window.setTimeout(() => {
      setSaving(false);
      toast("Profile saved", "Your details are up to date.", "success");
    }, 350);
  };

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/missions", { cache: "no-store", credentials: "include" });
      const json = res.ok
        ? ((await res.json()) as { missions?: unknown[] })
        : { missions: [] };
      const payload = {
        exportedAt: new Date().toISOString(),
        account: {
          email,
          displayName: name || null,
          role,
          memberSince: createdAt || null,
        },
        preferences: {
          defaultSurface: user.defaultSurface,
          confirmDelete: user.confirmDelete,
          onboarded: user.onboarded,
        },
        projects: json.missions ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gravity-export.json";
      a.click();
      URL.revokeObjectURL(url);
      toast("Export ready", "Your data download has begun.", "success");
    } catch {
      toast("Export failed", "Could not collect your data right now.", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="studio-settings-group">
        <div className="studio-settings-group-head">
          <h2 className="studio-settings-title">Profile</h2>
          <p className="studio-meta">YOUR IDENTITY</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="studio-avatar" style={{ height: 48, width: 48, fontSize: 14 }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-ivory">{name.trim() || "GRAVITY user"}</p>
            <p className="studio-meta mt-1">
              {memberSince ? `Member since ${memberSince}` : "Member"}
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div className="studio-field">
            <label className="studio-label" htmlFor="st-name">
              Display name
            </label>
            <input
              id="st-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="studio-input"
              autoComplete="name"
            />
          </div>
          <div className="studio-field">
            <label className="studio-label" htmlFor="st-role">
              Role
            </label>
            <select
              id="st-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="studio-select"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="studio-field studio-field-full">
            <label className="studio-label" htmlFor="st-email">
              Email
            </label>
            <div className="flex items-center gap-3">
              <input
                id="st-email"
                type="email"
                value={email ?? ""}
                readOnly
                disabled
                className="studio-input"
              />
            </div>
            <p className="studio-field-hint">
              <Mail className="mr-1 inline size-3" />
              Managed by your sign-in provider. Contact support to change it.
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end">
          <button type="button" onClick={save} disabled={saving} className="studio-primary-button">
            {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="studio-settings-group">
        <div className="studio-settings-group-head">
          <h2 className="studio-settings-title">Your data</h2>
          <p className="studio-meta">PORTABLE & YOURS</p>
        </div>
        <p className="studio-settings-copy">
          Download everything this workspace holds about you — account details, preferences, and every
          project with its receipts — as a single JSON file.
        </p>
        <div className="mt-5">
          <button
            type="button"
            onClick={exportData}
            disabled={exporting}
            className="studio-secondary-button"
          >
            <Download className="size-3.5" />
            {exporting ? "Preparing…" : "Export my data"}
          </button>
        </div>
      </div>
    </>
  );
}

function BillingTab({ usage }: { usage: Usage }) {
  const month = usage.month ?? 0;
  const pct = Math.min(100, (month / FREE_LIMIT) * 100);
  const low = pct < 70;

  const [state, setState] = React.useState<{
    credits: number;
    plan: string;
    planExpiresAt: string | null;
    plans?: Record<string, { label: string; priceInr: number; mult: number }>;
    usage: { chat: number; mission: number; bench_chunk: number; refine: number };
    hasKey: boolean;
    masked: string | null;
    packs: { id: string; inr: number; credits: number }[];
    invoices: { id: string; pack: string; amountInr: number; credits: number; at: string }[];
    razorpayConfigured: boolean;
    razorpayKeyId: string | null;
  } | null>(null);
  const [keyDraft, setKeyDraft] = React.useState("");
  const [savingKey, setSavingKey] = React.useState(false);
  const [paying, setPaying] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/billing", { credentials: "include" });
      if (res.ok) setState(await res.json());
    } catch {
      /* offline */
    }
  }, []);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadRazorpay = React.useCallback(async (): Promise<boolean> => {
    if (typeof (window as unknown as { Razorpay?: unknown }).Razorpay !== "undefined") return true;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("checkout.js failed"));
      document.body.appendChild(s);
    }).catch(() => undefined);
    return typeof (window as unknown as { Razorpay?: unknown }).Razorpay !== "undefined";
  }, []);

  const saveKey = async () => {
    if (!keyDraft.trim() || savingKey) return;
    setSavingKey(true);
    try {
      const res = await fetch("/api/billing/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key: keyDraft.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; masked?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setKeyDraft("");
      toast("Key saved", `Validated live. Calls now bill ${data.masked}.`, "success");
      void refresh();
    } catch (err) {
      toast("Key rejected", err instanceof Error ? err.message : "save failed", "error");
    } finally {
      setSavingKey(false);
    }
  };

  const removeKey = async () => {
    await fetch("/api/billing/keys", { method: "DELETE", credentials: "include" }).catch(() => undefined);
    toast("Key removed", "Calls fall back to shared key + free quota.");
    void refresh();
  };

  const topUp = async (packId: string) => {
    if (paying) return;
    setPaying(packId);
    try {
      const orderRes = await fetch("/api/billing/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pack: packId }),
      });
      const order = (await orderRes.json()) as { orderId?: string; amount?: number; currency?: string; keyId?: string; error?: string };
      if (!orderRes.ok || !order.orderId) throw new Error(order.error ?? "order failed");
      if (!(await loadRazorpay())) throw new Error("payment window failed to load");
      const RazorpayCtor = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;
      await new Promise<void>((resolve, reject) => {
        const rzp = new RazorpayCtor({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "GRAVITY Studio",
          description: "Credit top-up",
          theme: { color: "#B8960C" },
          handler: (resp: unknown) => {
            const r = resp as { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
            fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                orderId: r.razorpay_order_id,
                paymentId: r.razorpay_payment_id,
                signature: r.razorpay_signature,
                pack: packId,
              }),
            })
              .then(async (v) => {
                const data = (await v.json()) as { ok?: boolean; credits?: number; error?: string };
                if (!v.ok) throw new Error(data.error ?? "verify failed");
                toast("Topped up", `${data.credits} credits in wallet.`, "success");
                void refresh();
                resolve();
              })
              .catch((e: unknown) => reject(e instanceof Error ? e : new Error("verify failed")));
          },
          modal: { ondismiss: () => reject(new Error("payment window closed")) },
        });
        rzp.open();
      });
    } catch (err) {
      toast("Top-up failed", err instanceof Error ? err.message : "try again", "error");
    } finally {
      setPaying(null);
    }
  };

  const subscribe = async (plan: "pro" | "pro_plus") => {
    if (paying) return;
    setPaying(plan);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { subscriptionId?: string; keyId?: string; error?: string };
      if (!res.ok || !data.subscriptionId) throw new Error(data.error ?? "subscribe failed");
      if (!(await loadRazorpay())) throw new Error("payment window failed to load");
      const RazorpayCtor = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;
      await new Promise<void>((resolve, reject) => {
        const rzp = new RazorpayCtor({
          key: data.keyId,
          subscription_id: data.subscriptionId,
          name: "GRAVITY Studio",
          description: `${plan.toUpperCase()} subscription`,
          theme: { color: "#B8960C" },
          handler: () => {
            fetch("/api/billing/subscribe/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ subscriptionId: data.subscriptionId, plan }),
            })
              .then(async (v) => {
                const c = (await v.json()) as { ok?: boolean; error?: string };
                if (!v.ok) throw new Error(c.error ?? "confirm failed");
                toast("Subscribed", `${plan.toUpperCase()} active.`, "success");
                void refresh();
                resolve();
              })
              .catch((e: unknown) => reject(e instanceof Error ? e : new Error("confirm failed")));
          },
          modal: { ondismiss: () => reject(new Error("payment window closed")) },
        });
        rzp.open();
      });
    } catch (err) {
      toast("Subscribe failed", err instanceof Error ? err.message : "try again", "error");
    } finally {
      setPaying(null);
    }
  };

  const onPlanAction = (plan: (typeof PLANS)[number]) => {
    if (plan.current) return;
    if (!state?.razorpayConfigured) {
      toast("Checkout soon", "Subscriptions go live with Razorpay keys — BYOK and free quota work today.");
      return;
    }
    if (plan.id === "pro" || plan.id === "pro_plus") void subscribe(plan.id);
    else toast("Noted", "We'll be in touch.", "success");
  };

  return (
    <>
      {/* ── Wallet + today's trial ── */}
      <div className="studio-settings-group">
        <div className="studio-settings-group-head">
          <h2 className="studio-settings-title">Wallet & usage</h2>
          <p className="studio-meta">
            {(state?.plan ?? "free").toUpperCase()}
            {state?.planExpiresAt ? ` · TILL ${new Date(state.planExpiresAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <div>
            <p className="studio-eyebrow">CREDITS</p>
            <p className="mt-2 font-serif text-2xl font-light text-ivory">
              {state ? state.credits.toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <p className="studio-eyebrow">FREE TRIAL TODAY</p>
            <p className="studio-meta mt-2">
              {state ? `${state.usage.chat}/5 chats · ${state.usage.mission}/1 missions` : "—"}
            </p>
          </div>
        </div>
        <p className="studio-settings-copy mt-4">
          1 chat = 1 credit · 1 mission = 5 · 1 benchmark chunk = 5. Credits deduct only after
          successful runs. Your own API key below skips credits entirely.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(state?.packs ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void topUp(p.id)}
              disabled={paying !== null || !state?.razorpayConfigured}
              title={state?.razorpayConfigured ? `Pay ₹${p.inr}` : "Top-ups go live with Razorpay keys"}
              className="studio-secondary-button"
            >
              {paying === p.id ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              +{p.credits} · ₹{p.inr}
            </button>
          ))}
        </div>
        {!state?.razorpayConfigured ? (
          <p className="studio-field-hint mt-3">Card top-ups activate once Razorpay keys are configured.</p>
        ) : null}
      </div>

      {/* ── BYOK ── */}
      <div className="studio-settings-group">
        <div className="studio-settings-group-head">
          <h2 className="studio-settings-title">Your OpenRouter key</h2>
          <p className="studio-meta">{state?.hasKey ? `SAVED · ${state.masked ?? ""}` : "NOT SET"}</p>
        </div>
        <p className="studio-settings-copy">
          Bring your own key for unlimited usage — calls bill your OpenRouter balance, never ours.
          Validated live on save, stored encrypted, never shown again.
        </p>
        {state?.hasKey ? (
          <div className="mt-4 flex items-center gap-3">
            <span className="studio-example-chip !text-gold">{state.masked}</span>
            <button type="button" onClick={() => void removeKey()} className="studio-secondary-button">
              <Trash2 className="size-3.5" /> Remove
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="sk-or-…"
              autoComplete="off"
              className="studio-input min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => void saveKey()}
              disabled={savingKey || !keyDraft.trim()}
              className="studio-primary-button"
            >
              {savingKey ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {savingKey ? "Validating…" : "Save key"}
            </button>
          </div>
        )}
      </div>

      <div className="studio-settings-group">
        <div className="studio-settings-group-head">
          <h2 className="studio-settings-title">Quota — one panel</h2>
          <p className="studio-meta">
            {(state?.plan ?? "free").toUpperCase()} · DAILY TRIAL + MONTHLY BACKSTOP
          </p>
        </div>
        {(() => {
          const mult = state?.plans?.[state?.plan ?? "free"]?.mult ?? 1;
          const rows = [
            { label: "Chats today", used: state?.usage.chat ?? 0, cap: 5 * mult },
            { label: "Missions today", used: state?.usage.mission ?? 0, cap: 1 * mult },
            { label: "Refines today", used: state?.usage.refine ?? 0, cap: 3 * mult },
          ];
          return (
            <div className="grid gap-4">
              {rows.map((r) => {
                const pct = Math.min(100, (r.used / Math.max(1, r.cap)) * 100);
                return (
                  <div key={r.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="studio-meta">{r.label.toUpperCase()}</p>
                      <p className="studio-meta">{r.used} / {r.cap}</p>
                    </div>
                    <div className="studio-usage-meter mt-2">
                      <div
                        className={`studio-usage-fill ${pct < 70 ? "" : "studio-usage-fill-high"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="studio-meta">MONTHLY BACKSTOP (ALL USERS)</p>
                  <p className="studio-meta">
                    {month.toLocaleString()} / {FREE_LIMIT.toLocaleString()}
                  </p>
                </div>
                <div className="studio-usage-meter mt-2">
                  <div
                    className={`studio-usage-fill ${low ? "" : "studio-usage-fill-high"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="studio-field-hint mt-2">
                  Daily trial resets midnight · monthly backstop resets {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · benchmarks are paid-only (key or credits).
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="studio-settings-group">
        <div className="studio-settings-group-head">
          <h2 className="studio-settings-title">Compare plans</h2>
          <p className="studio-meta">UPGRADE ANYTIME</p>
        </div>
        <div className="studio-plan-grid">
          {PLANS.map((plan) => (
            <div key={plan.id} className={`studio-plan-card ${plan.current ? "studio-plan-card-current" : ""}`}>
              <div className="studio-plan-name">
                <span className="studio-eyebrow">{plan.name}</span>
                {plan.current ? <span className="studio-example-chip !text-gold">CURRENT</span> : null}
              </div>
              <div className="studio-plan-price">
                <span className="studio-plan-amount">{plan.price}</span>
                <span className="studio-plan-period">{plan.period}</span>
              </div>
              <p className="studio-plan-desc">{plan.tagline}</p>
              <div className="studio-plan-features">
                {plan.features.map((feature) => (
                  <div key={feature} className="studio-plan-feature">
                    <Check className="studio-plan-feature-icon size-3.5" />
                    {feature}
                  </div>
                ))}
              </div>
              <div className="studio-plan-cta">
                <button
                  type="button"
                  onClick={() => onPlanAction(plan)}
                  disabled={plan.current}
                  className={plan.current ? "studio-secondary-button w-full" : "studio-primary-button w-full"}
                >
                  {plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="studio-settings-group">
        <div className="studio-settings-group-head">
          <h2 className="studio-settings-title">Invoices</h2>
          <p className="studio-meta">RECEIPTS</p>
        </div>
        {(state?.invoices ?? []).length === 0 ? (
          <div className="studio-empty" style={{ padding: "34px 20px" }}>
            <CreditCard className="size-5 text-gold" />
            <h3 className="mt-3 font-serif text-lg">No invoices yet.</h3>
            <p className="studio-muted mt-1 max-w-sm">
              Top-ups and subscriptions land here as receipts.
            </p>
          </div>
        ) : (
          <div className="studio-list">
            {(state?.invoices ?? []).map((inv) => (
              <div key={inv.id} className="studio-list-item">
                <span className="studio-list-icon">
                  <CreditCard className="size-3.5" />
                </span>
                <div className="studio-list-body">
                  <p className="studio-list-title">
                    {inv.pack} · ₹{inv.amountInr} · +{inv.credits} credits
                  </p>
                  <p className="studio-list-meta">
                    {inv.at ? new Date(inv.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PreferencesTab({ email }: { email: string | null }) {
  const user = useGravityUser();
  const [surface, setSurface] = React.useState(user.defaultSurface);
  const [confirmDelete, setConfirmDelete] = React.useState(user.confirmDelete);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSurface(user.defaultSurface);
      setConfirmDelete(user.confirmDelete);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user.confirmDelete, user.defaultSurface]);

  const save = () => {
    user.update({ defaultSurface: surface, confirmDelete });
    toast("Preferences saved", "GRAVITY will behave the way you set.", "success");
  };

  return (
    <div className="studio-settings-group">
      <div className="studio-settings-group-head">
        <h2 className="studio-settings-title">Preferences</h2>
        <p className="studio-meta">PER-WORKSPACE DEFAULTS</p>
      </div>

      <div className="studio-field">
        <label className="studio-label" htmlFor="st-surface">
          Landing surface after sign-in
        </label>
        <select
          id="st-surface"
          value={surface}
          onChange={(e) => setSurface(e.target.value as "home" | "projects")}
          className="studio-select"
        >
          <option value="home">Studio home</option>
          <option value="projects">Projects</option>
        </select>
        <p className="studio-field-hint">Where you arrive after signing in.</p>
      </div>

      <div className="mt-2">
        <div className="studio-toggle-row">
          <div>
            <p className="studio-toggle-label">Confirm before deleting</p>
            <p className="studio-toggle-desc">
              Ask for confirmation before a project is permanently removed.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={confirmDelete}
            onClick={() => setConfirmDelete((v) => !v)}
            className={`studio-switch ${confirmDelete ? "studio-switch-on" : ""}`}
          >
            <span className="sr-only">Confirm before deleting</span>
          </button>
        </div>
        <div className="studio-toggle-row">
          <div>
            <p className="studio-toggle-label">Reduced motion</p>
            <p className="studio-toggle-desc">
              Respect the system preference for fewer animations. Dark theme is part of the brand —
              it stays.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={false}
            disabled
            className="studio-switch"
          >
            <span className="sr-only">Reduced motion</span>
          </button>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between gap-4 border-t border-border pt-6">
        <p className="studio-meta">SIGNED IN AS {email?.toUpperCase() ?? "—"}</p>
        <button type="button" onClick={save} className="studio-primary-button">
          <Check className="size-3.5" /> Save preferences
        </button>
      </div>
    </div>
  );
}

function SecurityTab({ email }: { email: string | null }) {
  const [resetting, setResetting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const resetPassword = async () => {
    if (!email || resetting) return;
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast("Reset email sent", `Check ${email} for the link.`, "success");
    } catch {
      toast("Could not send reset", "Check the address and try again.", "error");
    } finally {
      setResetting(false);
    }
  };

  const deleteAccount = () => {
    setDeleting(true);
    window.setTimeout(() => {
      setDeleting(false);
      setConfirmOpen(false);
      toast("Account deletion requested", "Our team will process this — you'll hear from us.", "error");
    }, 700);
  };

  return (
    <>
      <div className="studio-settings-group">
        <div className="studio-settings-group-head">
          <h2 className="studio-settings-title">Sign-in & sessions</h2>
          <p className="studio-meta">AUTHENTICATED BY FIREBASE</p>
        </div>
        <div className="studio-list">
          <div className="studio-list-item">
            <span className="studio-list-icon">
              <User className="size-3.5" />
            </span>
            <div className="studio-list-body">
              <p className="studio-list-title">{email ?? "Signed in"}</p>
              <p className="studio-list-meta">EMAIL · ACTIVE SESSION</p>
            </div>
          </div>
          <div className="studio-list-item">
            <span className="studio-list-icon">
              <Shield className="size-3.5" />
            </span>
            <div className="studio-list-body">
              <p className="studio-list-title">This device</p>
              <p className="studio-list-meta">PASSWORD + COOKIE · CURRENT DEVICE</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button type="button" onClick={resetPassword} disabled={resetting || !email} className="studio-secondary-button">
            <Send className="size-3.5" />
            {resetting ? "Sending…" : "Send password reset email"}
          </button>
        </div>
      </div>

      <div className="studio-settings-group" style={{ borderColor: "rgba(143,74,74,0.3)" }}>
        <div className="studio-settings-group-head">
          <h2 className="studio-settings-title" style={{ color: "var(--color-danger-text)" }}>
            Danger zone
          </h2>
          <p className="studio-meta">IRREVERSIBLE</p>
        </div>
        <p className="studio-settings-copy">
          Deleting your account removes your profile and access to this workspace. Projects are not
          deleted automatically — export anything you need first.
        </p>
        <div className="mt-5">
          <button type="button" onClick={() => setConfirmOpen(true)} className="studio-danger-button">
            <Trash2 className="size-3.5" /> Delete account
          </button>
        </div>
      </div>

      {confirmOpen ? (
        <div className="studio-dialog-overlay" role="dialog" aria-modal="true" aria-label="Delete account">
          <div className="studio-dialog">
            <p className="studio-dialog-kicker">IRREVERSIBLE ACTION</p>
            <h3 className="studio-dialog-title">Delete this account?</h3>
            <p className="studio-dialog-copy">
              This removes your identity from GRAVITY. A member of our team will confirm before it is
              processed.
            </p>
            <div className="studio-dialog-actions">
              <button type="button" onClick={() => setConfirmOpen(false)} className="studio-secondary-button">
                Keep account
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleting}
                className="studio-danger-button"
              >
                <Trash2 className="size-3.5" />
                {deleting ? "Requesting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}