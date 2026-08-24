"use client";

import * as React from "react";
import { Panel, Meta } from "@/components/gravity/primitives";
import { DecisionMatrix, ValueOfIntelligencePanel, ReasoningBudgetPanel } from "@/components/gravity/DecisionEngine";
import type { RoutingDecision, IntelligenceStrategy, StrategyKind } from "@/lib/gravity/types";

interface RouterRow {
  id: string;
  missionId: string;
  candidates: { strategy: string; name: string; suitabilityScore: number; estimatedCost: number; estimatedLatencyMs: number; estimatedQuality: number; reasoning: string }[];
  selectedStrategy: string;
  escalationLevel: number;
  voiScore: number;
  confidence: number;
  reasoning: string;
  estimatedTokens: number | null;
  maxTokens: number | null;
}

const STRAT_NAMES: Record<string, string> = {
  deterministic: "SQL / Python",
  statistical: "XGBoost / Prophet",
  small_llm: "Small LLM (cloud)",
  specialist_agent: "Specialist Agent",
  advanced_reasoning: "Advanced Reasoning",
  multi_agent: "Multi-Agent Workflow",
};

function rowToDecision(row: RouterRow): RoutingDecision {
  const candidates: IntelligenceStrategy[] = row.candidates.map((c) => ({
    kind: c.strategy as StrategyKind,
    label: STRAT_NAMES[c.strategy] ?? c.name,
    suitability: c.suitabilityScore,
    expectedQuality: Math.round(c.estimatedQuality * 100),
    estimatedCost: c.estimatedCost,
    latencyMs: c.estimatedLatencyMs,
    risk: c.suitabilityScore > 80 ? ("low" as const) : c.suitabilityScore > 50 ? ("medium" as const) : ("high" as const),
    confidence: Math.round(row.confidence * 100),
  }));

  const winner = candidates.find((c) => c.kind === row.selectedStrategy);

  return {
    missionId: row.missionId,
    candidates,
    selected: row.selectedStrategy as StrategyKind,
    selectedLabel: winner?.label ?? STRAT_NAMES[row.selectedStrategy] ?? row.selectedStrategy,
    reason: row.reasoning,
    escalationLevel: row.escalationLevel,
    valueOfIntelligence: {
      currentQuality: winner?.expectedQuality ?? 80,
      additionalQuality: 5,
      additionalCost: 0.01,
      latencyImpactMs: 2000,
      riskImpact: "medium",
      verdict: row.escalationLevel > 3 ? "escalate" : "sufficient",
    },
    budget: {
      tokenBudget: row.maxTokens ?? 8000,
      usedTokens: row.estimatedTokens ?? 0,
      expectedCost: 0,
      actualCost: 0,
      confidence: Math.round(row.confidence * 100),
      decision: (row.estimatedTokens ?? 0) > (row.maxTokens ?? 8000) * 0.8 ? "escalate" : "stop",
    },
  };
}

export default function RouterPage() {
  const [rows, setRows] = React.useState<RouterRow[] | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/router", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.live && json.items.length > 0) {
          setRows(json.items);
          setSelected(json.items[0].id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows || rows.length === 0 || !selected) {
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
          <Panel index="05" title="Live Routing Decisions">
            <p className="text-[13px] text-ivory-faint italic px-4 py-3">
              No routing decisions yet — run a mission from the home page and its full decision matrix will appear here.
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  const mission = rows.find((m) => m.id === selected)!;
  const decision = rowToDecision(mission);

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Core Architecture · Live Data</div>
          <h1 className="section-title mb-4">Intelligence <em>Router</em></h1>
          <p className="section-desc">
            The central mechanism of GRAVITY. Profiles each problem, selects the cheapest sufficient computation,
            executes, evaluates, and feeds outcomes back into future routing.
          </p>
        </div>

        <div className="grid grid-cols-[280px_1fr] gap-6">
          {/* Mission List */}
          <div>
            <Meta>Select Mission</Meta>
            <div className="mt-3 space-y-0.5 max-h-[600px] overflow-y-auto">
              {rows.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={`w-full text-left p-4 border transition-colors ${
                    selected === m.id
                      ? "border-gold/30 bg-gold-pale"
                      : "border-border bg-deep hover:bg-surface"
                  }`}
                >
                  <div className="font-mono text-[8px] tracking-[0.15em] uppercase text-gold mb-1">{m.missionId?.slice(0, 8)}</div>
                  <Meta>{m.selectedStrategy}</Meta>
                  {m.escalationLevel !== null && (
                    <span className="ml-2 font-mono text-[9px] text-ivory-faint">L{m.escalationLevel}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Analysis */}
          <div className="space-y-6">
            <DecisionMatrix decision={decision} />
            <ValueOfIntelligencePanel decision={decision} />
            <ReasoningBudgetPanel decision={decision} />
          </div>
        </div>
      </div>
    </div>
  );
}
