"use client";

import * as React from "react";
import { SectionBlock, Panel, Bar } from "@/components/gravity/primitives";
import { cn } from "@/lib/utils";

const PROBLEMS = [
  {
    id: "A",
    title: "Calculate avg monthly sales",
    voi: 0,
    voiLabel: "VoI = 0",
    required: "No LLM required",
    approach: "SQL/Python — Direct, exact, deterministic",
    tokenCost: "$0.00",
    latency: "< 100ms",
    color: "#4A8F6A",
    comparison: {
      naive: { tokens: 8000, cost: "$0.024", quality: "Same", time: "2.1s" },
      gravity: { tokens: 0, cost: "$0.00", quality: "Exact", time: "0.05s" },
    },
  },
  {
    id: "B",
    title: "Forecast next month demand",
    voi: 45,
    voiLabel: "VoI = Medium",
    required: "No LLM required",
    approach: "XGBoost, ARIMA, Prophet — chosen by validation",
    tokenCost: "$0.00",
    latency: "1 - 8s",
    color: "#8F8F4A",
    comparison: {
      naive: { tokens: 12000, cost: "$0.036", quality: "Worse (72%)", time: "4.5s" },
      gravity: { tokens: 0, cost: "$0.00", quality: "Better (93%)", time: "3.2s" },
    },
  },
  {
    id: "C",
    title: "Summarise 50 complaints",
    voi: 85,
    voiLabel: "VoI = High",
    required: "LLM required — but compressed",
    approach: "Embed → Cluster → Sample → LLM synthesis",
    tokenCost: "~$0.003",
    latency: "8 - 15s",
    color: "#B8960C",
    comparison: {
      naive: { tokens: 50000, cost: "$0.15", quality: "Noisy (68%)", time: "18s" },
      gravity: { tokens: 5000, cost: "$0.003", quality: "Clean (89%)", time: "12s" },
    },
  },
];

const COMPRESSION_STEPS = [
  { num: "01", input: "50 raw customer complaints received", action: "Initial count", reduction: "" },
  { num: "02", input: "Remove duplicates and near-duplicates", action: "Filter duplicates", reduction: "→ 39 documents (22% reduction)" },
  { num: "03", input: "Embed all documents locally — zero cost", action: "Nomic Embed (local)", reduction: "→ 39 embeddings" },
  { num: "04", input: "K-means clustering — 5 complaint themes", action: "Cluster", reduction: "→ 5 clusters" },
  { num: "05", input: "Pick 1 representative per cluster", action: "Sample representatives", reduction: "→ 5 key documents" },
  { num: "06", input: "LLM synthesises 5 representatives", action: "Targeted LLM synthesis", reduction: "→ Final insight report" },
];

export default function VoIPage() {
  const [selected, setSelected] = React.useState("C");
  const problem = PROBLEMS.find((p) => p.id === selected)!;

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Core Concept</div>
          <h1 className="section-title mb-4">Value of <em>Intelligence</em></h1>
          <p className="section-desc">
            Before invoking an expensive reasoning model, GRAVITY estimates whether additional intelligence
            is likely to materially improve the result.
          </p>
        </div>

        {/* Problem Selector */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {PROBLEMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={cn(
                "p-5 border text-left transition-all duration-200",
                selected === p.id
                  ? "border-gold/40 bg-gold-pale shadow-lg"
                  : "border-border bg-deep hover:bg-surface"
              )}
            >
              <div className="kicker mb-2" style={{ color: p.color }}>Problem {p.id} — {p.voiLabel}</div>
              <div className="font-serif text-lg text-ivory mb-2">{p.title}</div>
              <div className="text-xs text-ivory-faint">{p.approach}</div>
              <div className="mt-2 font-mono text-[10px]" style={{ color: p.color }}>
                Token cost: {p.tokenCost} · Latency: {p.latency}
              </div>
            </button>
          ))}
        </div>

        {/* Comparison */}
        <div className="grid grid-cols-2 gap-6 mb-10">
          <Panel title="Naive Approach — All LLM">
            <div className="p-5 border border-danger/20 bg-danger/5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="kicker text-danger-text mb-1">Tokens</div>
                  <div className="font-serif text-2xl text-ivory">{problem.comparison.naive.tokens.toLocaleString()}</div>
                </div>
                <div>
                  <div className="kicker text-danger-text mb-1">Cost</div>
                  <div className="font-serif text-2xl text-danger-text">{problem.comparison.naive.cost}</div>
                </div>
                <div>
                  <div className="kicker text-danger-text mb-1">Quality</div>
                  <div className="font-serif text-2xl text-ivory-faint">{problem.comparison.naive.quality}</div>
                </div>
                <div>
                  <div className="kicker text-danger-text mb-1">Time</div>
                  <div className="font-serif text-2xl text-ivory-faint">{problem.comparison.naive.time}</div>
                </div>
              </div>
            </div>
          </Panel>
          <Panel title="GRAVITY Approach">
            <div className="p-5 border border-success/20 bg-success/5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="kicker text-success-text mb-1">Tokens</div>
                  <div className="font-serif text-2xl text-ivory">{problem.comparison.gravity.tokens.toLocaleString()}</div>
                </div>
                <div>
                  <div className="kicker text-success-text mb-1">Cost</div>
                  <div className="font-serif text-2xl text-success-text">{problem.comparison.gravity.cost}</div>
                </div>
                <div>
                  <div className="kicker text-success-text mb-1">Quality</div>
                  <div className="font-serif text-2xl text-ivory">{problem.comparison.gravity.quality}</div>
                </div>
                <div>
                  <div className="kicker text-success-text mb-1">Time</div>
                  <div className="font-serif text-2xl text-ivory">{problem.comparison.gravity.time}</div>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Savings Banner */}
        <div className="text-center border border-border bg-gold-pale2 p-8 mb-10">
          <div className="kicker-gold mb-2">Cost Reduction</div>
          <div className="font-serif text-4xl font-light text-gold mb-2">
            {problem.comparison.naive.cost !== "$0.00"
              ? `${Math.round((1 - parseFloat(problem.comparison.gravity.cost.replace("$", "")) / parseFloat(problem.comparison.naive.cost.replace("$", ""))) * 100)}%`
              : "Same cost — but better quality"}
          </div>
          <div className="text-sm text-ivory-faint">
            {problem.comparison.naive.tokens.toLocaleString()} tokens → {problem.comparison.gravity.tokens.toLocaleString()} tokens
          </div>
        </div>

        {/* Intelligence Compression Pipeline — Problem C */}
        {selected === "C" && (
          <Panel title="Intelligence Compression Pipeline — Problem C">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-0">
                {COMPRESSION_STEPS.map((s, i) => (
                  <div key={i}>
                    <div className="grid grid-cols-[50px_1fr] border border-border bg-void">
                      <div className="px-3 py-3 border-r border-border flex items-center justify-center">
                        <span className="font-mono text-[11px] text-gold">{s.num}</span>
                      </div>
                      <div className="px-4 py-3 text-[12px] text-ivory-dim">{s.input}</div>
                    </div>
                    {s.reduction && (
                      <div className="px-4 py-1 bg-void border-x border-border text-[10px] text-gold font-mono">
                        {s.action} {s.reduction}
                      </div>
                    )}
                    {i < COMPRESSION_STEPS.length - 1 && (
                      <div className="text-center py-1 bg-void border-x border-border font-mono text-[10px] text-gold-dim">↓</div>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <h4 className="kicker-gold mb-4">Result Comparison</h4>
                <div className="p-4 border border-danger/20 bg-deep border-l-[3px] border-l-danger mb-3">
                  <div className="kicker text-danger-text mb-2">Naive Approach</div>
                  <div className="text-xs text-ivory-dim">
                    50 documents to LLM directly. Context: ~50k tokens. Cost: ~$0.15.
                    Noisy context degrades quality.
                  </div>
                </div>
                <div className="p-4 border border-success/20 bg-deep border-l-[3px] border-l-success mb-3">
                  <div className="kicker text-success-text mb-2">GRAVITY Approach</div>
                  <div className="text-xs text-ivory-dim">
                    5 representative documents to LLM. Context: ~5k tokens. Cost: ~$0.003.
                    98% cost reduction. Cleaner output.
                  </div>
                </div>
                <div className="p-4 border border-gold/20 bg-deep border-l-[3px] border-l-gold">
                  <div className="kicker-gold mb-2">The Principle</div>
                  <div className="text-xs text-ivory-dim italic font-serif">
                    The LLM should not be treated as a database. It should receive decision-relevant context —
                    not the entire raw dataset.
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* Adaptive Reasoning Budget */}
        <div className="mt-10">
          <h3 className="font-serif text-2xl text-ivory mb-6">Adaptive Reasoning Budget</h3>
          <p className="text-sm text-ivory-dim mb-6">
            GRAVITY does not allocate a fixed token budget. The reasoning budget scales dynamically with complexity,
            uncertainty, and risk.
          </p>
          <div className="grid-4">
            <div className="bg-deep p-5">
              <h4 className="kicker text-success-text mb-2">Low Complexity</h4>
              <div className="font-mono text-xs text-success-text mb-2">0 - 2k tokens</div>
              <p className="text-[11px] text-ivory-faint">Deterministic or small model. FAQ, data retrieval, simple classification.</p>
            </div>
            <div className="bg-deep p-5">
              <h4 className="kicker text-warning-text mb-2">Medium</h4>
              <div className="font-mono text-xs text-warning-text mb-2">2k - 8k tokens</div>
              <p className="text-[11px] text-ivory-faint">Small/medium model. Summaries, moderate research, code generation.</p>
            </div>
            <div className="bg-deep p-5">
              <h4 className="kicker text-gold mb-2">High</h4>
              <div className="font-mono text-xs text-gold mb-2">8k - 20k tokens</div>
              <p className="text-[11px] text-ivory-faint">Advanced model. Deep research, multi-step reasoning, strategy.</p>
            </div>
            <div className="bg-deep p-5">
              <h4 className="kicker text-strategy-multi mb-2">Critical</h4>
              <div className="font-mono text-xs text-strategy-multi mb-2">Adaptive + Human</div>
              <p className="text-[11px] text-ivory-faint">Multi-agent plus verification plus human approval for high-risk.</p>
            </div>
          </div>

          <div className="mt-6 p-5 border border-border bg-void">
            <h4 className="kicker-gold mb-3">Early Stopping Logic</h4>
            <pre className="font-mono text-xs text-ivory-faint leading-loose">
{`Reason → Evaluate → Confidence above threshold?
  YES: STOP. Return result.
  NO:  Allocate more intelligence. Escalate one level.`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
