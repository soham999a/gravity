"use client";

import * as React from "react";
import { SectionBlock, Panel, Bar, StatusDot, KeyValue } from "@/components/gravity/primitives";
import { Badge } from "@/components/ui/badge";
import { Activity, Zap, DollarSign, Clock, Target, TrendingUp, Brain, Shield } from "lucide-react";

const KPIs = [
  { label: "Task Success Rate", value: "91%", target: ">85%", icon: <Target size={16} />, color: "text-success-text" },
  { label: "Routing Accuracy", value: "94%", target: ">90%", icon: <Brain size={16} />, color: "text-success-text" },
  { label: "Cost per Task", value: "$0.008", target: "<$0.02", icon: <DollarSign size={16} />, color: "text-success-text" },
  { label: "Tasks Without LLM", value: "63%", target: ">40%", icon: <Zap size={16} />, color: "text-success-text" },
  { label: "Hallucination Rate", value: "2.1%", target: "<5%", icon: <Shield size={16} />, color: "text-success-text" },
  { label: "Human Escalation", value: "7%", target: "<10%", icon: <Activity size={16} />, color: "text-success-text" },
];

const EFFICIENCY = [
  { label: "L0 Deterministic", tasks: 42, color: "deterministic" },
  { label: "L1 Statistical / ML", tasks: 21, color: "statistical" },
  { label: "L2 Small LLM (local)", tasks: 22, color: "gold" },
  { label: "L3 Specialist Agent", tasks: 10, color: "agent" },
  { label: "L5 Multi-Agent", tasks: 5, color: "multi" },
];

const RECENT_MISSIONS = [
  { id: "1", prompt: "Demand forecasting — next 30 days", strategy: "statistical", cost: "$0.00", latency: "3.2s", confidence: 93, status: "completed" },
  { id: "2", prompt: "Summarise 50 customer complaints", strategy: "small_llm", cost: "$0.003", latency: "12.4s", confidence: 87, status: "completed" },
  { id: "3", prompt: "Analyse 12% quarterly sales decline", strategy: "multi_agent", cost: "$0.018", latency: "21s", confidence: 91, status: "completed" },
  { id: "4", prompt: "Research Oman real estate market", strategy: "multi_agent", cost: "$0.024", latency: "45s", confidence: 84, status: "completed" },
  { id: "5", prompt: "Detect anomalies in transactions", strategy: "deterministic", cost: "$0.00", latency: "0.8s", confidence: 96, status: "completed" },
];

interface DashKpis {
  successRate: number;
  avgQuality: number;
  costPerTask: number;
  noLlmShare: number;
  totalMissions: number;
  totalTokens: number;
}

interface DashPayload {
  kpis: DashKpis;
  strategyCounts: Record<string, number>;
  recent: {
    id: string;
    prompt: string;
    strategy: string;
    complexity: string;
    cost: string;
    tokens: number;
    latencyMs: number;
    confidence: number;
    status: string;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DashPayload | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.live) setData(json);
      } catch {
        /* keep fallback */
      }
      if (!cancelled) setTimeout(load, 6000);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = data?.kpis;
  const liveRecent = data?.recent;

  const kpiCards = [
    { label: "Task Success Rate", value: kpis ? `${Math.round(kpis.successRate * 100)}%` : "—", target: ">85%", icon: <Target size={16} /> },
    { label: "Output Quality", value: kpis ? `${Math.round(kpis.avgQuality * 100)}%` : "—", target: ">80%", icon: <Brain size={16} /> },
    { label: "Cost per Task", value: "$0.00", target: "<$0.02", icon: <DollarSign size={16} /> },
    { label: "Tasks Without LLM", value: kpis ? `${Math.round(kpis.noLlmShare * 100)}%` : "—", target: ">40%", icon: <Zap size={16} /> },
    { label: "Total Missions", value: kpis ? String(kpis.totalMissions) : "—", target: "live", icon: <Activity size={16} /> },
    { label: "Total Tokens Saved", value: kpis ? `${(kpis.totalTokens / 1000).toFixed(1)}k` : "—", target: "$0 spend", icon: <TrendingUp size={16} /> },
  ];

  const effMap: Record<string, { label: string; color: string }> = {
    deterministic: { label: "L0 Deterministic", color: "deterministic" },
    statistical: { label: "L1 Statistical / ML", color: "statistical" },
    small_llm: { label: "L2 Small LLM (cloud)", color: "gold" },
    specialist_agent: { label: "L3 Specialist Agent", color: "agent" },
    advanced_reasoning: { label: "L4 Advanced Reasoning", color: "agent" },
    multi_agent: { label: "L5 Multi-Agent", color: "multi" },
  };
  const totalStrategy = Object.values(data?.strategyCounts ?? {}).reduce((s, n) => s + n, 0);
  const efficiency = Object.entries(data?.strategyCounts ?? {}).map(([k, v]) => ({
    label: effMap[k]?.label ?? k,
    tasks: totalStrategy > 0 ? Math.round((v / totalStrategy) * 100) : 0,
    color: effMap[k]?.color ?? "gold",
  }));

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Platform Overview</div>
          <h1 className="section-title mb-4">Intelligence <em>Dashboard</em></h1>
          <p className="section-desc">Real-time metrics across all GRAVITY intelligence allocations.</p>
        </div>

        {/* KPIs */}
        <div className="grid-4 mb-10">
          {kpiCards.map((kpi) => (
            <div key={kpi.label}>
              <div className="kicker mb-1.5">{kpi.label}</div>
              <div className="font-serif text-3xl font-light text-gold mb-1">{kpi.value}</div>
              <div className="text-[13px] text-ivory-faint">Target: {kpi.target}</div>
            </div>
          ))}
        </div>

        {/* Efficiency Bars */}
        <Panel title={`Computational Efficiency${totalStrategy > 0 ? ` — ${totalStrategy} Live Missions` : ""}`} className="mb-10">
          {efficiency.length === 0 ? (
            <p className="text-[13px] text-ivory-faint italic">No missions yet — run one from the home page.</p>
          ) : (
            <div className="space-y-3">
              {efficiency.map((e) => (
                <div key={e.label} className="flex items-center gap-3.5">
                  <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-ivory-faint w-[190px] shrink-0">
                    {e.label}
                  </span>
                  <div className="flex-1 bg-border h-[18px]">
                    <div
                      className={`h-full flex items-center pl-2 font-mono text-[8px] transition-all duration-1000 ${
                        e.color === "deterministic" ? "bg-strategy-deterministic/25 text-strategy-deterministic" :
                        e.color === "statistical" ? "bg-strategy-statistical/25 text-strategy-statistical" :
                        e.color === "gold" ? "bg-gold/25 text-gold" :
                        e.color === "agent" ? "bg-strategy-agent/25 text-strategy-agent" :
                        "bg-strategy-multi/25 text-strategy-multi"
                      }`}
                      style={{ width: `${e.tasks}%` }}
                    >
                      {e.tasks}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-ivory-faint mt-4 italic">
            Every mission routed to the minimum sufficient intelligence level. All inference on free tiers — $0.00 spend.
          </p>
        </Panel>

        {/* Recent Missions */}
        <Panel title="Recent Missions">
          {!liveRecent || liveRecent.length === 0 ? (
            <p className="text-[13px] text-ivory-faint italic px-4 py-3">No live missions yet.</p>
          ) : (
            <div className="space-y-0.5">
              {liveRecent.map((m) => (
                <div key={m.id} className="grid grid-cols-[1fr_120px_80px_80px_60px_80px] gap-4 items-center px-4 py-3 border border-border bg-void hover:bg-surface transition-colors">
                  <div className="text-sm text-ivory font-light truncate">{m.prompt}</div>
                  <Badge strategy={m.strategy} variant="strategy">{m.strategy}</Badge>
                  <span className="font-mono text-[11px] text-success-text">{m.cost}</span>
                  <span className="font-mono text-[11px] text-ivory-faint">{m.latencyMs >= 1000 ? `${(m.latencyMs / 1000).toFixed(1)}s` : `${m.latencyMs}ms`}</span>
                  <span className="font-mono text-[11px] text-ivory-dim">{m.confidence}%</span>
                  <StatusDot status={m.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
