"use client";

import * as React from "react";
import { SectionBlock, Panel } from "@/components/gravity/primitives";
import { cn } from "@/lib/utils";

const LADDER = [
  {
    level: 0,
    name: "Deterministic Computation",
    description: "Python functions · SQL queries · Mathematical algorithms · Rule engines · Regex · Data transformations · OR-Tools",
    tokenCost: "$0.00",
    latency: "Under 500ms",
    reliability: "Exact",
    color: "#4A8F6A",
    colorBg: "#1A4A2A",
    colorBorder: "#2A5A3A",
    examples: ["Calculate avg monthly revenue", "Optimise delivery routes", "Format data output"],
  },
  {
    level: 1,
    name: "Statistical / ML Intelligence",
    description: "XGBoost · Prophet · ARIMA · Isolation Forest · K-Means · Scikit-learn · Mathematical optimisers",
    tokenCost: "$0.00",
    latency: "50ms - 8s",
    reliability: "High",
    color: "#6A8F6A",
    colorBg: "#1A3A2A",
    colorBorder: "#2A4A3A",
    examples: ["Forecast demand", "Detect anomalies", "Classify transactions"],
  },
  {
    level: 2,
    name: "Small / Local Language Model",
    description: "Ollama: Mistral 7B · Llama 3.2 3B · Qwen 2.5 1.5B — for FAQ, simple generation, classification, NL to SQL",
    tokenCost: "$0.00",
    latency: "0.5 - 4s",
    reliability: "Good",
    color: "#8F8F4A",
    colorBg: "#3A3A1A",
    colorBorder: "#4A4A2A",
    examples: ["Answer product FAQ", "Simple classification", "NL to SQL translation"],
  },
  {
    level: 3,
    name: "Specialist Agent",
    description: "Domain-specific agent with tools: Research Agent · Vision Agent · Code Agent · SQL Agent with reasoning",
    tokenCost: "Low",
    latency: "3 - 20s",
    reliability: "Good",
    color: "#8F6A4A",
    colorBg: "#3A2A1A",
    colorBorder: "#4A3A2A",
    examples: ["Research market trends", "Generate listing from photo", "Write and execute code"],
  },
  {
    level: 4,
    name: "Advanced Reasoning Model",
    description: "Ollama: Llama 3.3 70B · Optional cloud API for verified high-complexity reasoning tasks only",
    tokenCost: "Medium",
    latency: "5 - 30s",
    reliability: "High",
    color: "#8F4A6A",
    colorBg: "#3A1A2A",
    colorBorder: "#4A2A3A",
    examples: ["Deep analysis", "Multi-step reasoning", "Strategy development"],
  },
  {
    level: 5,
    name: "Multi-Agent Deliberation",
    description: "Planner plus Parallel Specialists plus Critic plus Synthesizer — for complex research, strategy, and analysis",
    tokenCost: "High",
    latency: "15 - 90s",
    reliability: "Validated",
    color: "#6A4A8F",
    colorBg: "#2A1A3A",
    colorBorder: "#3A2A4A",
    examples: ["Market research", "Complex strategy", "Multi-perspective analysis"],
  },
  {
    level: 6,
    name: "Human Decision",
    description: "System prepares full analysis, recommendation, and confidence report. Human makes the final call.",
    tokenCost: "Sunk",
    latency: "Human time",
    reliability: "Maximum",
    color: "#B8960C",
    colorBg: "rgba(184,150,12,0.07)",
    colorBorder: "#8A6F09",
    examples: ["High-risk financial decisions", "Regulatory approval", "Ethical review"],
  },
];

export default function EscalationPage() {
  const [active, setActive] = React.useState<number | null>(null);
  const [animating, setAnimating] = React.useState(false);

  const startAnimation = () => {
    setAnimating(true);
    let i = 0;
    const interval = setInterval(() => {
      setActive(i);
      i++;
      if (i >= LADDER.length) {
        clearInterval(interval);
        setTimeout(() => {
          setActive(null);
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
            onClick={() => setActive(null)}
            className="px-6 py-2 border border-border-light text-ivory-faint font-mono text-[9px] tracking-[0.15em] uppercase hover:bg-surface transition-colors"
          >
            Reset
          </button>
        </div>

        {/* The Ladder */}
        <div className="flex flex-col">
          {LADDER.map((rung, i) => {
            const isActive = active === rung.level;
            const isPast = active !== null && rung.level < active;

            return (
              <React.Fragment key={rung.level}>
                <div
                  className={cn(
                    "grid grid-cols-[80px_1fr_170px] border border-border transition-all duration-300 cursor-pointer",
                    isActive ? "bg-surface scale-[1.01] z-10 shadow-lg" : isPast ? "opacity-50" : "bg-deep hover:bg-surface"
                  )}
                  style={{ borderLeftColor: rung.color, borderLeftWidth: "3px" }}
                  onMouseEnter={() => !animating && setActive(rung.level)}
                  onMouseLeave={() => !animating && setActive(null)}
                >
                  <div
                    className="flex items-center justify-center py-6 border-r border-border font-mono text-sm"
                    style={{ color: rung.color }}
                  >
                    L{rung.level}
                  </div>
                  <div className="py-5 px-6">
                    <div className="font-serif text-lg text-ivory mb-1">{rung.name}</div>
                    <div className="text-xs text-ivory-faint leading-relaxed">{rung.description}</div>
                    {isActive && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rung.examples.map((ex) => (
                          <span key={ex} className="font-mono text-[8px] px-2 py-0.5 border border-border-light text-ivory-faint">
                            {ex}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div
                    className="py-5 px-4 border-l border-border flex flex-col justify-center"
                    style={{ color: rung.color }}
                  >
                    <div className="font-mono text-xs">Token cost: {rung.tokenCost}</div>
                    <div className="font-mono text-xs">Latency: {rung.latency}</div>
                    <div className="font-mono text-xs">Reliability: {rung.reliability}</div>
                  </div>
                </div>
                {i < LADDER.length - 1 && (
                  <div className="text-center py-0.5 bg-void border-x border-border font-mono text-[10px]" style={{ color: `${rung.color}88` }}>
                    {rung.level < 6 ? "↓ down — insufficient" : ""}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Quote */}
        <div className="mt-8 p-6 border border-border-light bg-gold-pale2">
          <p className="font-serif text-lg font-light text-ivory leading-relaxed italic">
            "The Escalation Ladder means GRAVITY starts with algorithms and climbs toward agents only when each
            level is demonstrably insufficient. This inverts the default assumption of agent-first systems."
          </p>
        </div>

        {/* Distribution */}
        <div className="mt-12">
          <h3 className="font-serif text-2xl text-ivory mb-6">Typical Distribution — 100 Tasks</h3>
          <div className="space-y-2">
            {[
              { level: "L0 Deterministic", pct: 42, color: "#4A8F6A" },
              { level: "L1 Statistical / ML", pct: 21, color: "#6A8F6A" },
              { level: "L2 Small LLM (local)", pct: 22, color: "#8F8F4A" },
              { level: "L3 Specialist Agent", pct: 10, color: "#8F6A4A" },
              { level: "L5 Multi-Agent", pct: 5, color: "#6A4A8F" },
            ].map((d) => (
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
