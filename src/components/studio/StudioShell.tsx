"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useGravityUser } from "@/lib/gravity-user";
import { ArrowUpRight, LogOut, Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "New task", href: "/?compose=1" },
  { label: "Projects", href: "/projects" },
  { label: "Settings", href: "/settings" },
  {
    label: "Technical architecture",
    href: "https://gravity-gules-sigma.vercel.app/",
    external: true,
  },
];

export function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const userName = useGravityUser((state) => state.name);
  const hydrate = useGravityUser((state) => state.hydrate);

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

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      document.cookie = "fb-token=; path=/; max-age=0";
    } catch {
      /* ignore */
    }
    router.replace("/login");
  };

  const displayName = userEmail ? (userEmail.split("@")[0] ?? "") : "";
  const initials = (userName || displayName || "GX")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="studio-app min-h-screen">
      <header className="studio-header">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            className="studio-icon-button"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <Link href="/" className="flex items-center gap-3">
            <span className="studio-mark">G</span>
            <span className="studio-wordmark">
              GRAVITY <span>/ STUDIO</span>
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="status-dot" />
            <span className="studio-meta">Live engine</span>
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
                className="studio-icon-button"
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
          <nav aria-label="Studio navigation" className="studio-nav-container">
            <div className="studio-nav-grid">
              {NAV_ITEMS.map((item, index) => {
                const active =
                  !item.external &&
                  (item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href.split("?")[0]) && item.href !== "/?compose=1");
                const content = (
                  <>
                    <span className="studio-nav-number">{String(index + 1).padStart(2, "0")}</span>
                    <span>{item.label}</span>
                    {item.external ? (
                      <ArrowUpRight className="ml-auto size-4" />
                    ) : null}
                  </>
                );
                return item.external ? (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                    className="studio-nav-link"
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`studio-nav-link ${active ? "studio-nav-link-active" : ""}`}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </nav>
          <p className="studio-nav-note">
            Choose a surface. GRAVITY routes the work to the right intelligence behind it.
          </p>
        </div>
      </div>

      <main className="studio-main">{children}</main>
    </div>
  );
}
