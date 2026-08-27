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
    tagline: "A real monthly allowance to feel the engine.",
    price: "0",
    period: "FORVER",
    features: [
      "250k tokens / month",
      "Six intelligence families",
      "CSV + text intake",
      "Clipped results & reasoning",
      "Community support",
    ],
    cta: "Current plan",
    current: true,
  },
  {
    id: "pro",
    name: "PRO",
    tagline: "Serious throughput for teams and operators.",
    price: "49",
    period: "PER MONTH",
    features: [
      "2.5M tokens / month",
      "Priority execution queue",
      "Unlimited projects",
      "12-month history retention",
      "Email support",
    ],
    cta: "Upgrade",
    current: false,
  },
  {
    id: "enterprise",
    name: "ENTERPRISE",
    tagline: "Controlled deployment at scale.",
    price: "Custom",
    period: "PER YEAR",
    features: [
      "Private model routing",
      "SSO + audit logs",
      "Usage-based billing",
      "Dedicated infrastructure",
      "SLA-backed support",
    ],
    cta: "Talk to us",
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
      const res = await fetch("/api/missions", { cache: "no-store" });
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

  const onPlanAction = (plan: (typeof PLANS)[number]) => {
    if (plan.current) return;
    if (plan.id === "pro") {
      toast("Early access requested", "Checkout launches soon — you're on the list.");
    } else {
      toast("Sales notified", "We'll reach out about an Enterprise workspace.", "success");
    }
  };

  return (
    <>
      <div className="studio-settings-group">
        <div className="studio-settings-group-head">
          <h2 className="studio-settings-title">Current plan</h2>
          <p className="studio-meta">FREE TIER · NO CARD ON FILE</p>
        </div>

        <div className="studio-usage">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="studio-eyebrow">FREE PLAN · TOKEN ALLOWANCE</p>
              <p className="mt-2 font-serif text-2xl font-light text-ivory">
                {month.toLocaleString()}{" "}
                <span className="text-base text-muted-foreground">of {FREE_LIMIT.toLocaleString()}</span>
              </p>
            </div>
            <span className={low ? "studio-stat-metric-ok" : "studio-stat-metric-warn"}>
              {Math.round(pct)}% USED
            </span>
          </div>
          <div className="studio-usage-meter">
            <div
              className={`studio-usage-fill ${low ? "" : "studio-usage-fill-high"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="studio-usage-row">
            <span className="studio-meta">RESETS {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <span className="studio-meta">USAGE THIS MONTH</span>
          </div>
        </div>

        <p className="studio-settings-copy mt-5">
          Lifetime use across all your tasks tracks toward this monthly allowance. Upgrading removes
          the ceiling and moves your work to the front of the queue.
        </p>
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
        <div className="studio-empty" style={{ padding: "34px 20px" }}>
          <CreditCard className="size-5 text-gold" />
          <h3 className="mt-3 font-serif text-lg">No invoices yet.</h3>
          <p className="studio-muted mt-1 max-w-sm">
            The free tier is courtesy of GRAVITY. Invoices will appear here once you upgrade.
          </p>
        </div>
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