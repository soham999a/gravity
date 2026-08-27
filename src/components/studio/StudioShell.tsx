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

function sectionFromPath(path: string): string {
  if (path === "/") return "Home";
  if (path.startsWith("/projects")) return "Projects";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/onboarding")) return "Setup";
  return "Studio";
}

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
  const section = sectionFromPath(pathname);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/?compose=1") return false;
    return pathname.startsWith(href);
  };

  const navContent = (item: { label: string; href: string }, index: number) => {
    const active = !item.href.includes("compose") && isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`studio-sidebar-link ${active ? "studio-sidebar-link-active" : ""}`}
      >
        <span className="studio-sidebar-number">{String(index + 1).padStart(2, "0")}</span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="studio-shell">
      <aside className="studio-sidebar">
        <Link href="/" className="studio-sidebar-brand">
          <img src="/logo.jpg" alt="" aria-hidden="true" className="studio-mark-img" />
          <span className="studio-wordmark">
            GRAVITY <span>/ STUDIO</span>
          </span>
        </Link>

        <nav aria-label="Studio navigation" className="studio-sidebar-nav">
          <p className="studio-nav-note">SURFACES</p>
          {NAV_ITEMS.map((item, index) => navContent(item, index))}
          <p className="studio-nav-note" style={{ marginTop: 22 }}>
            SYSTEM
          </p>
          <a
            href={EXTERNAL_LINK.href}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="studio-sidebar-link"
          >
            <span className="studio-sidebar-number">05</span>
            <span>{EXTERNAL_LINK.label}</span>
            <ArrowUpRight className="ml-auto size-3.5" />
          </a>
        </nav>

        <div className="studio-sidebar-bottom">
          <Link href="/settings" className="studio-sidebar-usage">
            <div className="flex items-baseline justify-between gap-2">
              <span className="studio-meta">FREE PLAN</span>
              {usagePct > 70 ? (
                <span className="studio-meta flex items-center gap-1 text-gold">
                  <Zap className="size-3" /> {Math.round(usagePct)}%
                </span>
              ) : (
                <span className="studio-meta">{Math.round(usagePct)}%</span>
              )}
            </div>
            <div className="studio-usage-meter" style={{ marginTop: 8, height: 2 }}>
              <div
                className={`studio-usage-fill ${usagePct > 70 ? "studio-usage-fill-high" : ""}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <p className="studio-usage-foot">
              {`${usage.toLocaleString()} / ${FREE_LIMIT.toLocaleString()}`}
              <span className="float-right">{usagePct > 70 ? "UPGRADE" : "MONTH"}</span>
            </p>
          </Link>

          <div className="studio-sidebar-user">
            <Link href="/settings" className="studio-avatar" title={userEmail ?? "Account"}>
              {initials}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="studio-sidebar-user-name">{displayName || fallbackName || "GRAVITY user"}</p>
              <p className="studio-meta">FREE TIER</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="studio-icon-button"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="studio-shell-main">
        <header className="studio-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              className="studio-icon-button studio-header-burger"
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <p className="studio-section-label">{section === "Setup" ? "SETUP" : `STUDIO / ${section.toUpperCase()}`}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="studio-live-dot" />
              <span className="studio-meta">Engine live</span>
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
              <p className="studio-nav-copy">Simplex: simple design of complexity.</p>
            </div>
            <nav aria-label="Mobile navigation" className="studio-nav-container">
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
                  className="studio-nav-link"
                >
                  <span className="studio-nav-number">05</span>
                  <span>{EXTERNAL_LINK.label}</span>
                  <ArrowUpRight className="ml-auto size-4" />
                </a>
              </div>
            </nav>
            <p className="studio-nav-note">
              Press ⌘K to jump anywhere · Choose a surface, GRAVITY routes the work.
            </p>
          </div>
        </div>

        <main className="studio-main">{children}</main>
      </div>

      <CommandPalette />
    </div>
  );
}