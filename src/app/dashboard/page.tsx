"use client";

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

export default function DashboardPage() {
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
          {KPIs.map((kpi) => (
            <div key={kpi.label}>
              <div className="kicker mb-1.5">{kpi.label}</div>
              <div className="font-serif text-3xl font-light text-gold mb-1">{kpi.value}</div>
              <div className="text-[13px] text-ivory-faint">Target: {kpi.target}</div>
            </div>
          ))}
        </div>

        {/* Efficiency Bars */}
        <Panel title="Computational Efficiency — 100 Tasks" className="mb-10">
          <div className="space-y-3">
            {EFFICIENCY.map((e) => (
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
                    {e.tasks} tasks
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ivory-faint mt-4 italic">
            63% solved without any LLM call. Only 5% require multi-agent workflows. All inference is local Ollama.
          </p>
        </Panel>

        {/* Recent Missions */}
        <Panel title="Recent Missions">
          <div className="space-y-0.5">
            {RECENT_MISSIONS.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_120px_80px_80px_60px_80px] gap-4 items-center px-4 py-3 border border-border bg-void hover:bg-surface transition-colors">
                <div className="text-sm text-ivory font-light truncate">{m.prompt}</div>
                <Badge strategy={m.strategy} variant="strategy">{m.strategy}</Badge>
                <span className="font-mono text-[11px] text-success-text">{m.cost}</span>
                <span className="font-mono text-[11px] text-ivory-faint">{m.latency}</span>
                <span className="font-mono text-[11px] text-ivory-dim">{m.confidence}%</span>
                <StatusDot status={m.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
