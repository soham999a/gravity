"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

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
    body: "Five workload classes through competing systems. Same task, same input, same criterion — public leaderboard.",
  },
];

/** 1st landing — front door. One action: Explore Gravity → the original
 *  studio homepage at /studio (2nd landing), where all work happens. */
export default function LandingPage() {
  return (
    <div className="ds">
      <section className="ds-hero">
        <Link href="/benchmark" className="ds-pill">
          <span className="ds-pill-dot" />
          <span>GRAVITY Core live — adaptive routing across L0–L5</span>
          <ArrowRight className="size-3.5" />
        </Link>
        <h1 className="ds-h1">
          Explore unreached <em>intelligence.</em>
        </h1>
        <p className="ds-sub">
          One surface that decides what form of intelligence your problem deserves —
          then proves it with a receipt.
        </p>
        <div className="ds-ctas">
          <Link href="/studio" className="ds-cta-primary">
            Explore Gravity <ArrowUpRight className="size-4" />
          </Link>
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
    </div>
  );
}
