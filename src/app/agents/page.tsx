"use client";

import * as React from "react";
import { Panel, Badge, StatusDot, Bar } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";

const FILTERS = ["All", "LLM", "Statistical", "ML", "Deterministic", "Hybrid", "Human"];

const AGENTS = [
  { id: "A001", name: "Research Agent", agentClass: "llm", escalation: 3, model: "llama3.3", tools: ["web_search", "url_fetch", "document_reader"], cost: "Medium", reliability: 82, status: "active" },
  { id: "A002", name: "Forecasting Agent", agentClass: "statistical", escalation: 1, model: "Prophet/XGBoost", tools: ["data_loader", "model_trainer"], cost: "Very Low", reliability: 94, status: "active" },
  { id: "A003", name: "Data Analyst", agentClass: "hybrid", escalation: 2, model: "mistral+python", tools: ["python_repl", "chart_renderer", "sql_executor"], cost: "Low", reliability: 88, status: "active" },
  { id: "A004", name: "SQL Agent", agentClass: "deterministic", escalation: 0, model: "None (direct SQL)", tools: ["sql_executor"], cost: "Free", reliability: 99, status: "active" },
  { id: "A005", name: "Anomaly Detector", agentClass: "ml", escalation: 1, model: "Isolation Forest", tools: ["data_loader"], cost: "Free", reliability: 91, status: "active" },
  { id: "A006", name: "Planner", agentClass: "llm", escalation: 4, model: "llama3.3", tools: ["task_decomposer"], cost: "Medium", reliability: 85, status: "active" },
  { id: "A007", name: "Critic", agentClass: "llm", escalation: 4, model: "llama3.3 (cross-model)", tools: ["fact_checker"], cost: "Medium", reliability: 87, status: "active" },
  { id: "A008", name: "Synthesizer", agentClass: "llm", escalation: 4, model: "llama3.3", tools: ["report_formatter"], cost: "Medium", reliability: 89, status: "active" },
  { id: "A009", name: "Route Optimizer", agentClass: "deterministic", escalation: 0, model: "OR-Tools", tools: ["optimizer"], cost: "Free", reliability: 98, status: "active" },
  { id: "A010", name: "Vision Agent", agentClass: "hybrid", escalation: 3, model: "qwen2.5-vl+llm", tools: ["image_reader", "ocr"], cost: "Low", reliability: 83, status: "active" },
  { id: "A011", name: "Human Reviewer", agentClass: "human", escalation: 6, model: "Human", tools: [], cost: "Human Time", reliability: 100, status: "active" },
  { id: "A012", name: "Code Agent", agentClass: "hybrid", escalation: 3, model: "llama3.3", tools: ["python_repl", "sandbox"], cost: "Low", reliability: 86, status: "active" },
];

export default function AgentsPage() {
  const [filter, setFilter] = React.useState("All");
  const filtered = filter === "All" ? AGENTS : AGENTS.filter((a) => a.agentClass === filter.toLowerCase());

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="kicker-gold mb-3">Registry</div>
            <h1 className="section-title mb-4">Agent <em>Registry</em></h1>
            <p className="section-desc">
              Not all agents are LLM agents. Each agent has a type, escalation level, cost profile, and fallback path.
            </p>
          </div>
          <Button variant="outline">Register Agent</Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-8">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-mono text-[9px] tracking-[0.12em] uppercase border transition-colors ${
                filter === f
                  ? "border-gold text-gold bg-gold-pale"
                  : "border-border text-ivory-faint hover:border-border-light"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="border border-border overflow-x-auto">
          <table className="w-full border-collapse bg-deep">
            <thead>
              <tr>
                {["Agent", "Class", "Level", "Model", "Tools", "LLM Required", "Reliability", "Status"].map((h) => (
                  <th key={h} className="font-mono text-[8px] tracking-[0.18em] uppercase text-gold px-4 py-3 border-b border-border text-left bg-surface">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3 border-b border-border">
                    <div className="text-ivory font-light text-xs">{a.name}</div>
                    <div className="font-mono text-[9px] text-ivory-faint">{a.id}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-border">
                    <Badge variant="default">{a.agentClass}</Badge>
                  </td>
                  <td className="px-4 py-3 border-b border-border font-mono text-xs text-gold text-center">L{a.escalation}</td>
                  <td className="px-4 py-3 border-b border-border font-mono text-[11px] text-ivory-dim">{a.model}</td>
                  <td className="px-4 py-3 border-b border-border">
                    <div className="flex flex-wrap gap-1">
                      {a.tools.map((t) => (
                        <span key={t} className="font-mono text-[8px] text-ivory-faint border border-border px-1.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-center">
                    <span className={`font-mono text-[10px] ${a.agentClass === "deterministic" || a.agentClass === "statistical" || a.agentClass === "ml" || a.agentClass === "human" ? "text-success-text" : "text-warning-text"}`}>
                      {a.agentClass === "deterministic" || a.agentClass === "statistical" || a.agentClass === "ml" || a.agentClass === "human" ? "No" : "Yes"}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <Bar value={a.reliability} color={a.reliability > 90 ? "success" : a.reliability > 80 ? "gold" : "warning"} />
                      <span className="font-mono text-[10px] text-ivory-dim">{a.reliability}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-center">
                    <StatusDot status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
