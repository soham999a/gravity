"use client";

import * as React from "react";
import { EscalationLadder } from "@/components/gravity/EscalationLadder";
import { Meta, Panel } from "@/components/gravity/primitives";

const DISTRIBUTION = [
  { level: "L0 Deterministic", pct: 42, color: "#4A8F6A" },
  { level: "L1 Statistical / ML", pct: 21, color: "#6A8F6A" },
  { level: "L2 Small LLM (local)", pct: 22, color: "#8F8F4A" },
  { level: "L3 Specialist Agent", pct: 10, color: "#8F6A4A" },
  { level: "L5 Multi-Agent", pct: 5, color: "#6A4A8F" },
];

export default function EscalationPage() {
  const [activeLevel, setActiveLevel] = React.useState(0);
  const [animating, setAnimating] = React.useState(false);

  const startAnimation = () => {
    setAnimating(true);
    let i = 0;
    const interval = setInterval(() => {
      setActiveLevel(i);
      i++;
      if (i > 6) {
        clearInterval(interval);
        setTimeout(() => {
          setActiveLevel(0);
          setAnimating(false);
        }, 3000);
      }
    }, 600);
  };

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Intelligence Allocation</div>
          <h1 className="section-title mb-4">The Escalation <em>Ladder</em></h1>
          <p className="section-desc">
            Every task enters at Level 0 and escalates only when the current level is insufficient.
            This is the single most important structural principle of GRAVITY.
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={startAnimation}
            disabled={animating}
            className="px-6 py-2 bg-gold text-void font-mono text-[9px] tracking-[0.15em] uppercase hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {animating ? "Animating..." : "Animate Ladder"}
          </button>
          <button
            onClick={() => setActiveLevel(0)}
            className="px-6 py-2 border border-border-light text-ivory-faint font-mono text-[9px] tracking-[0.15em] uppercase hover:bg-surface transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Escalation Ladder Component */}
        <EscalationLadder activeLevel={activeLevel} />

        {/* Distribution */}
        <div className="mt-12">
          <h3 className="font-serif text-2xl text-ivory mb-6">Typical Distribution — 100 Tasks</h3>
          <div className="space-y-2">
            {DISTRIBUTION.map((d) => (
              <div key={d.level} className="flex items-center gap-4">
                <span className="w-[200px] shrink-0 font-mono text-[9px] tracking-[0.1em] uppercase text-ivory-faint">{d.level}</span>
                <div className="flex-1 h-[18px] bg-border">
                  <div
                    className="h-full flex items-center pl-2 font-mono text-[8px] transition-all duration-1000"
                    style={{ width: `${d.pct}%`, backgroundColor: `${d.color}40`, color: d.color }}
                  >
                    {d.pct} tasks
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ivory-faint mt-3 italic">
            63% solved without any LLM call. Only 5% require multi-agent workflows.
          </p>
        </div>
      </div>
    </div>
  );
}
