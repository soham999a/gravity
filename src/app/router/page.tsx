"use client";

import * as React from "react";
import { Panel, Bar, Badge } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";

const MISSIONS = [
  { id: "MS-001", prompt: "Demand forecasting — next 30 days", strategy: "statistical", escalation: 1, voi: 0, confidence: 93 },
  { id: "MS-003", prompt: "Analyse 12% quarterly sales decline", strategy: "multi_agent", escalation: 5, voi: 87, confidence: 91 },
  { id: "MS-004", prompt: "Research Oman real estate market", strategy: "multi_agent", escalation: 5, voi: 92, confidence: 84 },
  { id: "MS-005", prompt: "Detect anomalies in transactions", strategy: "deterministic", escalation: 0, voi: 0, confidence: 96 },
];

const CANDIDATES = [
  { strategy: "deterministic", name: "SQL / Python", score: 28, cost: "$0.00", latency: "<100ms" },
  { strategy: "statistical", name: "XGBoost / Prophet", score: 92, cost: "$0.00", latency: "1-8s" },
  { strategy: "small_llm", name: "Mistral 7B (Ollama)", score: 45, cost: "$0.00", latency: "0.5-4s" },
  { strategy: "specialist_agent", name: "Research Agent", score: 38, cost: "Low", latency: "3-20s" },
  { strategy: "advanced_reasoning", name: "Llama 3.3 70B", score: 22, cost: "Medium", latency: "5-30s" },
  { strategy: "multi_agent", name: "Multi-Agent Workflow", score: 15, cost: "High", latency: "15-90s" },
];

export default function RouterPage() {
  const [selected, setSelected] = React.useState(MISSIONS[0].id);
  const mission = MISSIONS.find((m) => m.id === selected)!;

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Core Architecture</div>
          <h1 className="section-title mb-4">Intelligence <em>Router</em></h1>
          <p className="section-desc">
            The central mechanism of GRAVITY. Profiles each problem, selects the cheapest sufficient computation,
            executes, evaluates, and feeds outcomes back into future routing.
          </p>
        </div>

        <div className="grid grid-cols-[280px_1fr] gap-6">
          {/* Mission List */}
          <div>
            <div className="kicker mb-3">Select Mission</div>
            <div className="space-y-0.5">
              {MISSIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={`w-full text-left p-4 border transition-colors ${
                    selected === m.id
                      ? "border-gold/30 bg-gold-pale"
                      : "border-border bg-deep hover:bg-surface"
                  }`}
                >
                  <div className="font-mono text-[8px] tracking-[0.15em] uppercase text-gold mb-1">{m.id}</div>
                  <div className="text-xs text-ivory font-light">{m.prompt}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge strategy={m.strategy} variant="strategy">{m.strategy}</Badge>
                    <span className="font-mono text-[9px] text-ivory-faint">L{m.escalation}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Analysis */}
          <div className="space-y-6">
            {/* Decision Matrix */}
            <Panel title="Decision Matrix — Candidate Strategies">
              <div className="space-y-2">
                {CANDIDATES.sort((a, b) => b.score - a.score).map((c) => (
                  <div key={c.name} className={`flex items-center gap-3 p-3 border transition-colors ${
                    c.name === "XGBoost / Prophet" ? "border-gold/30 bg-gold-pale" : "border-border bg-void"
                  }`}>
                    <span className="font-mono text-[10px] text-ivory-faint w-[140px] shrink-0">{c.name}</span>
                    <div className="flex-1 h-2 bg-border">
                      <Bar
                        value={c.score}
                        color={c.name === "XGBoost / Prophet" ? "gold" : "deterministic"}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-ivory-dim w-8 text-right">{c.score}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 border border-border bg-void">
                <div className="kicker-gold mb-2">Selected Strategy</div>
                <div className="text-sm text-gold font-light">XGBoost — Escalation Level 1 (Statistical/ML)</div>
                <div className="text-xs text-ivory-faint mt-1">
                  Strong historical signal. Structured numerical features. No natural-language reasoning required.
                  XGBoost MAPE = 4.2% on holdout.
                </div>
              </div>
            </Panel>

            {/* VoI */}
            <Panel title="Value of Intelligence Analysis">
              <div className="grid-3">
                <div className="border border-border bg-void p-4">
                  <div className="kicker mb-1 text-success-text">Quality</div>
                  <div className="font-serif text-xl text-ivory">High</div>
                  <div className="text-xs text-ivory-faint mt-1">ML model outperforms LLM on structured data</div>
                </div>
                <div className="border border-border bg-void p-4">
                  <div className="kicker mb-1 text-gold">Cost</div>
                  <div className="font-serif text-xl text-ivory">$0.00</div>
                  <div className="text-xs text-ivory-faint mt-1">Zero tokens consumed</div>
                </div>
                <div className="border border-border bg-void p-4">
                  <div className="kicker mb-1 text-strategy-multi">Latency</div>
                  <div className="font-serif text-xl text-ivory">3.2s</div>
                  <div className="text-xs text-ivory-faint mt-1">ML inference, no network round-trip</div>
                </div>
              </div>
            </Panel>

            {/* Reasoning Budget */}
            <Panel title="Reasoning Budget">
              <div className="flex items-center gap-4 mb-4">
                <div>
                  <div className="kicker mb-1">Estimated Tokens</div>
                  <div className="font-serif text-2xl text-gold">0</div>
                </div>
                <div className="flex-1 h-2 bg-border">
                  <div className="h-full bg-gold" style={{ width: "0%" }} />
                </div>
                <div>
                  <div className="kicker mb-1">Max Budget</div>
                  <div className="font-serif text-2xl text-ivory-faint">8,000</div>
                </div>
              </div>
              <div className="p-3 border border-border bg-void">
                <span className="font-mono text-xs text-ivory-faint">
                  Reason → Evaluate → <span className="text-gold">Confidence 93% above threshold (80%)</span> → <span className="text-success-text">STOP. Return result.</span>
                </span>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
