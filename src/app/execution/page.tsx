"use client";

import * as React from "react";
import { Panel, Badge, StatusDot } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";

const EXECUTIONS = [
  { id: "EX-001", mission: "MS-003", prompt: "Analyse 12% quarterly sales decline", nodes: 7, status: "completed" },
  { id: "EX-002", mission: "MS-004", prompt: "Research Oman real estate market", nodes: 9, status: "completed" },
  { id: "EX-003", mission: "MS-006", prompt: "Generate product listing from photo", nodes: 4, status: "completed" },
];

const NODES = [
  { id: "N1", name: "SQL Agent", type: "deterministic", stage: "Data Collection", purpose: "Query quarterly revenue data", status: "completed", cost: 0, tokens: 0, latency: 180, confidence: 98 },
  { id: "N2", name: "Forecasting Agent", type: "statistical", stage: "Analysis", purpose: "XGBoost on 18 months of sales", status: "completed", cost: 0, tokens: 0, latency: 2100, confidence: 93 },
  { id: "N3", name: "Research Agent", type: "specialist_agent", stage: "Research", purpose: "Market research via web search", status: "completed", cost: 0.008, tokens: 6200, latency: 12000, confidence: 84 },
  { id: "N4", name: "Research Agent 2", type: "specialist_agent", stage: "Research", purpose: "Competitor analysis", status: "completed", cost: 0.006, tokens: 4800, latency: 9500, confidence: 81 },
  { id: "N5", name: "Synthesizer", type: "advanced_reasoning", stage: "Synthesis", purpose: "Aggregate findings into report", status: "completed", cost: 0.004, tokens: 7400, latency: 8000, confidence: 89 },
  { id: "N6", name: "Critic", type: "advanced_reasoning", stage: "Evaluation", purpose: "Cross-validate claims", status: "completed", cost: 0, tokens: 0, latency: 0, confidence: 91 },
  { id: "N7", name: "Result Formatter", type: "deterministic", stage: "Output", purpose: "Format final report", status: "completed", cost: 0, tokens: 0, latency: 50, confidence: 100 },
];

export default function ExecutionPage() {
  const [selectedRun, setSelectedRun] = React.useState(EXECUTIONS[0].id);

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Intelligence</div>
          <h1 className="section-title mb-4">Execution <em>Canvas</em></h1>
          <p className="section-desc">
            Visual execution graph with node-by-node inspection and real-time status tracking.
          </p>
        </div>

        {/* Run Selector */}
        <div className="flex gap-3 mb-8">
          {EXECUTIONS.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedRun(e.id)}
              className={`p-4 border text-left transition-colors flex-1 ${
                selectedRun === e.id
                  ? "border-gold/30 bg-gold-pale"
                  : "border-border bg-deep hover:bg-surface"
              }`}
            >
              <div className="font-mono text-[8px] tracking-[0.15em] uppercase text-gold mb-1">{e.id}</div>
              <div className="text-xs text-ivory font-light truncate">{e.prompt}</div>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-mono text-[9px] text-ivory-faint">{e.nodes} nodes</span>
                <StatusDot status={e.status} />
              </div>
            </button>
          ))}
        </div>

        {/* Execution Graph */}
        <Panel title="Execution Graph — Node Inspector">
          <div className="space-y-2">
            {/* Stages */}
            {["Data Collection", "Analysis", "Research", "Synthesis", "Evaluation", "Output"].map((stage) => {
              const stageNodes = NODES.filter((n) => n.stage === stage);
              if (stageNodes.length === 0) return null;
              return (
                <div key={stage}>
                  <div className="kicker mb-2 mt-4">{stage}</div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${stageNodes.length}, 1fr)` }}>
                    {stageNodes.map((node) => (
                      <div key={node.id} className="border border-border bg-void p-4 hover:border-gold/30 transition-colors cursor-pointer group">
                        <div className="flex items-center justify-between mb-2">
                          <Badge strategy={node.type} variant="strategy">{node.type}</Badge>
                          <StatusDot status={node.status} />
                        </div>
                        <div className="text-sm text-ivory font-light mb-1">{node.name}</div>
                        <div className="text-[11px] text-ivory-faint mb-3">{node.purpose}</div>
                        <div className="grid grid-cols-3 gap-2 border-t border-border pt-2">
                          <div>
                            <div className="kicker text-[7px] mb-0.5">Latency</div>
                            <div className="font-mono text-[10px] text-ivory-dim">{node.latency}ms</div>
                          </div>
                          <div>
                            <div className="kicker text-[7px] mb-0.5">Tokens</div>
                            <div className="font-mono text-[10px]" style={{ color: node.tokens === 0 ? "var(--color-success-text)" : "var(--color-ivory-dim)" }}>{node.tokens || "—"}</div>
                          </div>
                          <div>
                            <div className="kicker text-[7px] mb-0.5">Confidence</div>
                            <div className="font-mono text-[10px] text-ivory-dim">{node.confidence}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {stage !== "Output" && (
                    <div className="text-center py-1 font-mono text-[10px] text-gold-dim">↓</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-8 grid grid-cols-5 gap-px bg-border border border-border">
            {[
              { label: "Total Cost", value: "$0.018" },
              { label: "Total Tokens", value: "18,400" },
              { label: "Total Latency", value: "21.0s" },
              { label: "Nodes", value: "7" },
              { label: "Avg Confidence", value: "91%" },
            ].map((s) => (
              <div key={s.label} className="bg-deep p-4 text-center">
                <div className="kicker mb-1">{s.label}</div>
                <div className="font-serif text-lg text-gold">{s.value}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
