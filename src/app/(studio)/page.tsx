"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AuthModal } from "@/components/auth/AuthModal";
import GravityField from "@/components/gravity/GravityField";

/** 1st landing — front door. One action: Explore Gravity → /studio.
 *  Logged-out visitors meet sign-in first, then land straight in /studio. */
export default function LandingPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = React.useState(
    () => typeof document !== "undefined" && document.cookie.includes("fb-token="),
  );
  const [authOpen, setAuthOpen] = React.useState(false);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setIsAuthed(Boolean(user)));
    return () => unsub();
  }, []);

  const explore = () => {
    if (isAuthed) router.push("/studio");
    else setAuthOpen(true);
  };

  return (
    <>
      {/* ── HERO — light gravity field ─────────────────────────── */}
      <section className="gv-hero">
        <div className="gv-film" aria-hidden="true">
          <GravityField />
        </div>

        <span className="gv-hero-index" aria-hidden="true">
          G / 001
        </span>

        <div className="gv-hero-inner">
          <p className="gv-kicker">
            <span className="gv-kicker-plus">+</span> ADAPTIVE INTELLIGENCE FABRIC
          </p>
          <h1 className="gv-h1">
            Explore unreached
            <br />
            <em>intelligence.</em>
          </h1>
          <p className="gv-sub">
            One surface that decides what form of intelligence your problem deserves — then
            proves it with a receipt.
          </p>
          <div className="gv-cta-row">
            <button type="button" onClick={explore} className="gv-cta">
              Explore Gravity <ArrowUpRight className="size-4" />
            </button>
            <p className="gv-cta-note">
              The right intelligence.
              <br />
              Not just more of it.
            </p>
          </div>
        </div>

        <div className="gv-hero-foot">
          <span className="gv-hero-cue">
            <span className="gv-hero-cue-ring">
              <ArrowDown className="size-3" />
            </span>
            INTELLIGENCE, BY DESIGN
          </span>
          <span className="gv-hero-fig">FIG. 01&nbsp;&nbsp;THE GRAVITY FIELD&nbsp;&nbsp;+</span>
        </div>
      </section>

      {/* ── PRINCIPLES — black ─────────────────────────────────── */}
      <section className="gv-dark" id="principles">
        <div className="gv-dark-head">
          <p className="gv-kicker gv-kicker-gold">
            <span className="gv-kicker-dot" /> THE GRAVITY PRINCIPLE
          </p>
          <h2 className="gv-dark-title">
            Intelligence is a choice.
            <br />
            <span>Make the right one.</span>
          </h2>
          <p className="gv-dark-count" aria-hidden="true">
            01 — 03
          </p>
        </div>

        <div className="gv-cols">
          <article className="gv-col">
            <div className="gv-col-top">
              <p className="gv-kicker gv-kicker-gold">ROUTE</p>
              <span className="gv-col-num">01</span>
            </div>
            <svg className="gv-diagram" viewBox="0 0 220 64" aria-hidden="true">
              <path d="M8 32 H84 L110 32 L136 12 H196" fill="none" stroke="rgba(184,150,12,0.7)" strokeWidth="1" />
              <path d="M84 32 L110 52 L150 52" fill="none" stroke="rgba(240,237,230,0.25)" strokeWidth="1" />
              <circle cx="8" cy="32" r="3.5" fill="none" stroke="#B8960C" strokeWidth="1" />
              <circle cx="150" cy="52" r="3.5" fill="none" stroke="rgba(240,237,230,0.35)" strokeWidth="1" />
              <circle cx="196" cy="12" r="3.5" fill="none" stroke="rgba(240,237,230,0.35)" strokeWidth="1" />
              <path d="M120 28 L128 32 L120 36" fill="none" stroke="#B8960C" strokeWidth="1" />
            </svg>
            <h3 className="gv-col-title">
              Less complexity.
              <br />
              More intelligence.
            </h3>
            <p className="gv-col-body">
              Deterministic, statistical, small model, agent or swarm — Gravity spends
              intelligence only where it pays.
            </p>
            <Link href="/benchmark" className="gv-col-link">
              Explore the routing engine <ArrowUpRight className="size-3.5" />
            </Link>
          </article>

          <article className="gv-col">
            <div className="gv-col-top">
              <p className="gv-kicker gv-kicker-gold">RECEIPT</p>
              <span className="gv-col-num">02</span>
            </div>
            <svg className="gv-diagram" viewBox="0 0 220 64" aria-hidden="true">
              <rect x="70" y="8" width="80" height="40" fill="none" stroke="rgba(240,237,230,0.25)" strokeWidth="1" />
              <path d="M70 48 l8 -7 l8 7 l8 -7 l8 7 l8 -7 l8 7 l8 -7 l8 7 l8 -7 l8 7" fill="none" stroke="rgba(240,237,230,0.25)" strokeWidth="1" />
              <line x1="82" y1="20" x2="118" y2="20" stroke="rgba(240,237,230,0.4)" strokeWidth="1" />
              <line x1="82" y1="28" x2="108" y2="28" stroke="rgba(240,237,230,0.25)" strokeWidth="1" />
              <circle cx="160" cy="18" r="10" fill="none" stroke="#B8960C" strokeWidth="1" />
              <path d="M155.5 18 l3.5 3.5 l6 -7" fill="none" stroke="#B8960C" strokeWidth="1" />
            </svg>
            <h3 className="gv-col-title">
              Every decision.
              <br />
              An explanation.
            </h3>
            <p className="gv-col-body">
              Candidates, rejected alternatives, cost, latency and confidence — an audit
              trail for each run.
            </p>
            <Link href="/studio" className="gv-col-link">
              Inside the studio <ArrowUpRight className="size-3.5" />
            </Link>
          </article>

          <article className="gv-col">
            <div className="gv-col-top">
              <p className="gv-kicker gv-kicker-gold">EVIDENCE</p>
              <span className="gv-col-num">03</span>
            </div>
            <svg className="gv-diagram" viewBox="0 0 220 64" aria-hidden="true">
              <line x1="60" y1="6" x2="60" y2="54" stroke="rgba(240,237,230,0.2)" strokeWidth="1" />
              <line x1="60" y1="54" x2="200" y2="54" stroke="rgba(240,237,230,0.2)" strokeWidth="1" />
              <polyline points="60,44 92,36 124,38 156,20 188,14" fill="none" stroke="#B8960C" strokeWidth="1" />
              <circle cx="92" cy="36" r="2.5" fill="#B8960C" />
              <circle cx="156" cy="20" r="2.5" fill="#B8960C" />
              <circle cx="188" cy="14" r="2.5" fill="none" stroke="#B8960C" strokeWidth="1" />
            </svg>
            <h3 className="gv-col-title">
              Measured.
              <br />
              Never vibes.
            </h3>
            <p className="gv-col-body">
              Four workload classes through competing systems. Same task, same input,
              same criterion — a public leaderboard.
            </p>
            <Link href="/benchmark" className="gv-col-link">
              View the benchmark <ArrowUpRight className="size-3.5" />
            </Link>
          </article>
        </div>
      </section>

      {/* ── FOOTER — black ─────────────────────────────────────── */}
      <footer className="gv-foot">
        <div className="gv-foot-top">
          <div>
            <p className="gv-simplex">Simplex.</p>
            <p className="gv-simplex-sub">Simple design of complexity.</p>
          </div>
          <div className="gv-foot-grid">
            <div>
              <p className="gv-foot-head">Product</p>
              <Link href="/studio">Studio</Link>
              <Link href="/projects">Projects</Link>
              <Link href="/benchmark">Benchmark</Link>
            </div>
            <div>
              <p className="gv-foot-head">Research</p>
              <Link href="/benchmark">Routing Engine</Link>
              <Link href="/classes">Workload Classes</Link>
              <Link href="/settings">Plans & Usage</Link>
            </div>
            <div>
              <p className="gv-foot-head">Legal</p>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </div>

        <p className="gv-giant" aria-hidden="true">
          GRAVITY<sup>®</sup>
        </p>

        <div className="gv-foot-base">
          <span>© 2026 GRAVITY · ADAPTIVE INTELLIGENCE FABRIC</span>
          <span className="gv-foot-status">
            <span className="gv-status-dot" /> ALL SYSTEMS NOMINAL
          </span>
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          setAuthOpen(false);
          router.push("/studio");
        }}
        reason="Sign in to enter the studio — your workspace waits on the other side."
      />
    </>
  );
}
