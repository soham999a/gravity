"use client";

import * as React from "react";
import { Panel, Bar } from "@/components/gravity/primitives";
import { useLiveData } from "@/hooks/useLiveData";

interface LedgerEntry {
  id: string;
  task: string;
  dataProfile: string;
  complexity: string;
  candidates: { name: string; score: number; selected: boolean }[];
  selectedStrategy: string;
  reasoning: string;
  rejectedAlternatives: string;
  llmCalls: number;
  tokens: number;
  cost: number;
  latencyMs: number;
  confidence: number | null;
  fallbackPath: string | null;
  outcome: string;
  timestamp: string;
}

const FALLBACK_ENTRIES: LedgerEntry[] = [
  {
    id: "DL-0042", task: "Demand Forecasting — next 30 days", dataProfile: "124,000 records · structured numerical · 18 months history · weekly seasonality · low missingness 2.1%",
    complexity: "Medium · Structured · No semantic reasoning required",
    candidates: [
      { name: "XGBoost", score: 92, selected: true },
      { name: "Prophet", score: 76, selected: false },
      { name: "ARIMA", score: 68, selected: false },
      { name: "LLM Agent", score: 28, selected: false },
    ],
    selectedStrategy: "XGBoost — Escalation Level 1 (Statistical/ML)",
    reasoning: "Strong historical signal. Structured numerical features. No natural-language reasoning required. Low semantic complexity.",
    rejectedAlternatives: "LLM Agent rejected: score 28 — no NL reasoning needed, 50x more expensive, 8x slower",
    llmCalls: 0, tokens: 0, cost: 0, latencyMs: 3200, confidence: 0.93,
    fallbackPath: "Prophet → Small LLM → Human Review",
    outcome: "success", timestamp: "2026-08-15T09:14:32Z",
  },
];

function mapLive(l: Record<string, unknown>): LedgerEntry {
  return {
    id: `DL-${String(l.id).slice(0, 8)}`,
    task: (l.task as string) ?? "—",
    dataProfile: (l.dataProfile as string) ?? "—",
    complexity: (l.complexity as string) ?? "—",
    candidates: (l.candidates as LedgerEntry["candidates"]) ?? [],
    selectedStrategy: `${l.selectedStrategy ?? "—"}${l.complexity ? "" : ""}`,
    reasoning: (l.reasoning as string) ?? "—",
    rejectedAlternatives: (l.rejectedAlternatives as string) ?? "—",
    llmCalls: (l.llmCalls as number) ?? 0,
    tokens: (l.tokens as number) ?? 0,
    cost: (l.cost as number) ?? 0,
    latencyMs: (l.latencyMs as number) ?? 0,
    confidence: l.confidence as number | null,
    fallbackPath: l.fallbackPath as string | null,
    outcome: (l.outcome as string) ?? "success",
    timestamp: new Date(String(l.timestamp)).toISOString().replace("T", " ").slice(0, 19) + " UTC",
  };
}

export default function LedgerPage() {
  const { data: liveEntries } = useLiveData<Record<string, unknown>>("/api/ledger", 8000);
  const entries = liveEntries ? liveEntries.map(mapLive) : FALLBACK_ENTRIES;
  const [expanded, setExpanded] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (entries.length > 0 && expanded === null) setExpanded(entries[0].id);
  }, [entries, expanded]);

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Explainability</div>
          <h1 className="section-title mb-4">Decision <em>Ledger</em></h1>
          <p className="section-desc">
            Every routing decision is recorded with its rationale. When a client asks why the system did not use AI —
            GRAVITY can answer: because AI was not the best intelligence for this problem.
          </p>
        </div>

        <div className="space-y-3">
          {entries.map((e) => (
            <div key={e.id} className="border border-border bg-deep overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                className="w-full text-left panel-header hover:bg-elevated transition-colors"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[9px] tracking-[0.15em] text-gold">{e.id}</span>
                    <span className="text-sm text-ivory font-light">{e.task}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-ivory-faint">
                    {e.timestamp} · LLM Calls: <span style={{ color: e.llmCalls === 0 ? "var(--color-success-text)" : "var(--color-ivory-dim)" }}>{e.llmCalls}</span> · Cost: <span style={{ color: e.cost === 0 ? "var(--color-success-text)" : "var(--color-ivory-dim)" }}>${e.cost}</span> · Confidence: {Math.round((e.confidence ?? 0) * 100)}%
                  </div>
                </div>
                <span className="font-mono text-[10px] text-gold">{expanded === e.id ? "−" : "+"}</span>
              </button>

              {/* Expanded */}
              {expanded === e.id && (
                <div className="grid grid-cols-2 border-t border-border">
                  <div className="p-6 border-r border-border">
                    <div className="mb-4">
                      <div className="kicker mb-1">Task</div>
                      <div className="text-sm text-ivory-dim">{e.task}</div>
                    </div>
                    <div className="mb-4">
                      <div className="kicker mb-1">Data Profile</div>
                      <div className="text-[12px] text-ivory-faint">{e.dataProfile}</div>
                    </div>
                    <div className="mb-4">
                      <div className="kicker mb-1">Complexity</div>
                      <div className="text-[12px] text-ivory-faint">{e.complexity}</div>
                    </div>
                    <div>
                      <div className="kicker mb-2">Candidates</div>
                      <div className="space-y-1.5">
                        {e.candidates.map((c) => (
                          <div key={c.name} className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-ivory-faint w-20">{c.name}</span>
                            <div className="flex-1 h-2 bg-border">
                              <Bar value={c.score} color={c.selected ? "gold" : "deterministic"} />
                            </div>
                            <span className="font-mono text-[10px] w-7 text-right" style={{ color: c.selected ? "var(--color-gold)" : "var(--color-ivory-dim)" }}>{c.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="mb-4">
                      <div className="kicker-gold mb-1">Selected Strategy</div>
                      <div className="text-sm text-gold">{e.selectedStrategy}</div>
                    </div>
                    <div className="mb-4">
                      <div className="kicker mb-1">Reasoning</div>
                      <div className="text-[12px] text-ivory-dim leading-relaxed">{e.reasoning}</div>
                    </div>
                    <div className="mb-4">
                      <div className="kicker mb-1">Rejected Alternatives</div>
                      <div className="text-[12px] text-ivory-faint">{e.rejectedAlternatives}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 border border-border bg-void">
                        <div className="kicker text-[7px] mb-0.5">LLM Calls</div>
                        <div className="font-serif text-xl" style={{ color: e.llmCalls === 0 ? "var(--color-success-text)" : "var(--color-ivory)" }}>{e.llmCalls}</div>
                      </div>
                      <div className="p-3 border border-border bg-void">
                        <div className="kicker text-[7px] mb-0.5">Tokens</div>
                        <div className="font-serif text-xl" style={{ color: e.tokens === 0 ? "var(--color-success-text)" : "var(--color-ivory)" }}>{e.tokens}</div>
                      </div>
                      <div className="p-3 border border-border bg-void">
                        <div className="kicker text-[7px] mb-0.5">Cost</div>
                        <div className="font-serif text-xl" style={{ color: e.cost === 0 ? "var(--color-success-text)" : "var(--color-ivory)" }}>${e.cost}</div>
                      </div>
                      <div className="p-3 border border-border bg-void">
                        <div className="kicker text-[7px] mb-0.5">Latency</div>
                        <div className="font-serif text-xl text-ivory">{(e.latencyMs / 1000).toFixed(1)}s</div>
                      </div>
                    </div>
                    <div>
                      <div className="kicker mb-1">Fallback Path</div>
                      <div className="text-[12px] text-ivory-faint">{e.fallbackPath ?? "�"}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
