"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useGravityUser } from "@/lib/gravity-user";
import { useMissionFeed } from "@/lib/gravity-missions";
import { CommandPalette } from "@/components/studio/CommandPalette";
import { ArrowUpRight, LogOut, Menu, X, Zap } from "lucide-react";

const FREE_LIMIT = 250_000;

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "New task", href: "/?compose=1" },
  { label: "Projects", href: "/projects" },
  { label: "Settings", href: "/settings" },
];

const EXTERNAL_LINK = {
  label: "Technical architecture",
  href: "https://gravity-gules-sigma.vercel.app/",
};

export function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const userName = useGravityUser((state) => state.name);
  const hydrate = useGravityUser((state) => state.hydrate);
  const { missions } = useMissionFeed();

  React.useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    let lastY = window.scrollY;
    let armed = false;
    const armTimer = window.setTimeout(() => (armed = true), 350);
    const onScroll = () => {
      if (!armed) return;
      const y = window.scrollY;
      if (y - lastY > 12) setOpen(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(armTimer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  React.useEffect(() => {
    hydrate();
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserEmail(user?.email ?? null);
    });
    return () => unsub();
  }, [hydrate]);

  const usage = React.useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return missions
      .filter((m) => new Date(m.createdAt).getTime() >= monthStart)
      .reduce((sum, m) => sum + (m.totalTokens ?? 0), 0);
  }, [missions]);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      document.cookie = "fb-token=; path=/; max-age=0";
    } catch {
      /* ignore */
    }
    router.replace("/login");
  };

  const usagePct = Math.min(100, (usage / FREE_LIMIT) * 100);
  const displayName = (userName || "").trim();
  const fallbackName = userEmail ? userEmail.split("@")[0] ?? "" : "";
  const initials = (displayName || fallbackName || "GX").slice(0, 2).toUpperCase();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/?compose=1") return false;
    return pathname.startsWith(href);
  };

  return (
    <div className="studio-app studio-shell">
      <header className="studio-header">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? "Close studio navigation" : "Open studio navigation"}
            aria-expanded={open}
            className="studio-icon-button"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <Link href="/" className="studio-header-brand" aria-label="GRAVITY Studio home">
            <span className="studio-mark">
              <img src="/gravity-logo-mark-transparent.png" alt="GRAVITY" className="studio-logo-image" />
            </span>
            <span className="studio-wordmark">
              <span className="studio-wordmark-main">GRAVITY</span>
              <span className="studio-wordmark-intelligence">INTELLIGENCE</span>
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="studio-live-dot" />
            <span className="studio-meta">Prototype environment</span>
          </div>
          {userEmail ? (
            <>
              <Link href="/settings" className="studio-avatar" title={userEmail}>
                {initials}
              </Link>
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                className="studio-icon-button studio-header-signout"
              >
                <LogOut className="size-3.5" />
              </button>
            </>
          ) : (
            <Link href="/login" className="studio-text-link">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div className={`studio-nav-panel ${open ? "studio-nav-panel-open" : ""}`}>
        <div className="studio-nav-panel-inner">
          <div className="studio-nav-intro">
            <span className="studio-nav-logo-frame">
              <img src="/gravity-logo-light.png" alt="GRAVITY" className="studio-nav-logo" />
            </span>
            <div className="min-w-0">
              <p className="studio-eyebrow">NEXT-GENERATION ADAPTIVE INTELLIGENCE FRAMEWORK</p>
              <p className="studio-nav-copy">Simplex: simple design of complexity.</p>
            </div>
          </div>

          <nav aria-label="Studio navigation" className="studio-nav-container">
            <div className="studio-nav-grid">
              {NAV_ITEMS.map((item, index) => {
                const active = !item.href.includes("compose") && isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`studio-nav-link ${active ? "studio-nav-link-active" : ""}`}
                  >
                    <span className="studio-nav-number">{String(index + 1).padStart(2, "0")}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <a
                href={EXTERNAL_LINK.href}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="studio-nav-link studio-nav-link-external"
              >
                <span className="studio-nav-number">05</span>
                <span className="min-w-0 flex-1">{EXTERNAL_LINK.label}</span>
                <ArrowUpRight className="ml-auto size-4 shrink-0" />
              </a>
            </div>
          </nav>

          <div className="studio-nav-foot">
            <Link href="/settings" className="studio-nav-usage">
              <div className="flex items-baseline justify-between gap-2">
                <span className="studio-meta">FREE PLAN · THIS MONTH</span>
                <span className="studio-meta flex items-center gap-1">
                  {usagePct > 70 ? <Zap className="size-3 text-gold" /> : null}
                  {Math.round(usagePct)}%
                  {usagePct > 70 ? " · UPGRADE" : ""}
                </span>
              </div>
              <div className="studio-usage-meter">
                <div
                  className={`studio-usage-fill ${usagePct > 70 ? "studio-usage-fill-high" : ""}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </Link>
            <p className="studio-nav-note">
              Press ⌘K to jump anywhere · Choose a surface, GRAVITY routes the work.
            </p>
          </div>
        </div>
      </div>

      <main className="studio-main">{children}</main>

      <CommandPalette />
    </div>
  );
}