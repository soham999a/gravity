"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AuthModal } from "@/components/auth/AuthModal";
import { GravityWell } from "@/components/gravity/GravityWell";

const PILLARS = [
  {
    kicker: "ROUTE",
    title: "Least complex sufficient path",
    body: "Deterministic, statistical, small model, agent or swarm — GRAVITY spends intelligence only where it pays.",
  },
  {
    kicker: "RECEIPT",
    title: "Every decision explainable",
    body: "Candidates, rejected alternatives, cost, latency and confidence — an audit trail for each run.",
  },
  {
    kicker: "EVIDENCE",
    title: "Measured, never vibes",
    body: "Four workload classes through competing systems. Same task, same input, same criterion — public leaderboard.",
  },
];

/** 1st landing — front door. One action: Explore Gravity → the original
 *  studio homepage at /studio (2nd landing), where all work happens.
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
    <div className="ds">
      {/* Spacetime bent around a decision — landing only. */}
      <GravityWell />
      <section className="ds-hero">
        <h1 className="ds-h1">
          Explore unreached <em>intelligence.</em>
        </h1>
        <p className="ds-sub">
          One surface that decides what form of intelligence your problem deserves —
          then proves it with a receipt.
        </p>
        <div className="ds-ctas">
          <button type="button" onClick={explore} className="ds-cta-primary">
            Explore Gravity <ArrowUpRight className="size-4" />
          </button>
        </div>
      </section>

      <section className="ds-pillars">
        {PILLARS.map((p) => (
          <div key={p.kicker} className="ds-pillar">
            <p className="ds-pillar-kicker">{p.kicker}</p>
            <h2 className="ds-pillar-title">{p.title}</h2>
            <p className="ds-pillar-body">{p.body}</p>
          </div>
        ))}
      </section>

      <footer className="ds-foot">
        <div className="ds-foot-grid">
          <div>
            <p className="ds-foot-head">Product</p>
            <Link href="/studio">Studio</Link>
            <Link href="/projects">Projects</Link>
            <Link href="/benchmark">Benchmark</Link>
          </div>
          <div>
            <p className="ds-foot-head">Research</p>
            <Link href="/benchmark">Routing Engine</Link>
            <Link href="/classes">Workload Classes</Link>
            <Link href="/settings">Plans & Usage</Link>
          </div>
          <div>
            <p className="ds-foot-head">Legal</p>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
        <div className="ds-foot-base">
          <span>© 2026 GRAVITY · Adaptive Intelligence Fabric</span>
          <span className="ds-foot-status">
            <span className="ds-pill-dot" /> All systems nominal
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
    </div>
  );
}
