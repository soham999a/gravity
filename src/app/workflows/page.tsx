"use client";

import * as React from "react";
import { Panel, Badge, StatusDot } from "@/components/gravity/primitives";

const WORKFLOWS = [
  {
    id: "WF-001", name: "Sales Decline Analysis", description: "Multi-agent analysis of declining sales with data, research, and synthesis",
    steps: [
      { name: "SQL Data Extraction", type: "deterministic", agent: "SQL Agent", tools: ["sql_executor"], timeout: 5000 },
      { name: "Trend Analysis", type: "statistical", agent: "Forecasting Agent", tools: ["data_loader"], timeout: 10000 },
      { name: "Market Research", type: "specialist_agent", agent: "Research Agent", tools: ["web_search", "url_fetch"], timeout: 30000 },
      { name: "Report Synthesis", type: "advanced_reasoning", agent: "Synthesizer", tools: ["report_formatter"], timeout: 20000 },
      { name: "Quality Validation", type: "advanced_reasoning", agent: "Critic", tools: ["fact_checker"], timeout: 15000 },
    ],
  },
  {
    id: "WF-002", name: "Complaint Summarization", description: "Intelligence Compression pipeline for document clustering and synthesis",
    steps: [
      { name: "Deduplicate", type: "deterministic", agent: null, tools: ["document_reader"], timeout: 5000 },
      { name: "Embed", type: "deterministic", agent: null, tools: ["Nomic Embed"], timeout: 10000 },
      { name: "Cluster", type: "statistical", agent: null, tools: ["K-Means"], timeout: 8000 },
      { name: "Sample Representatives", type: "deterministic", agent: null, tools: [], timeout: 2000 },
      { name: "LLM Synthesis", type: "small_llm", agent: null, tools: ["Mistral 7B"], timeout: 15000 },
    ],
  },
  {
    id: "WF-003", name: "Anomaly Detection", description: "Statistical pipeline for transaction anomaly detection",
    steps: [
      { name: "Data Ingestion", type: "deterministic", agent: "SQL Agent", tools: ["sql_executor"], timeout: 5000 },
      { name: "Isolation Forest", type: "statistical", agent: "Anomaly Detector", tools: ["data_loader"], timeout: 8000 },
      { name: "Z-Score Filter", type: "statistical", agent: null, tools: [], timeout: 2000 },
      { name: "Alert Generation", type: "deterministic", agent: null, tools: ["http_client"], timeout: 1000 },
    ],
  },
  {
    id: "WF-004", name: "Product Listing from Photo", description: "Vision + LLM pipeline for e-commerce content generation",
    steps: [
      { name: "Image Analysis", type: "specialist_agent", agent: "Vision Agent", tools: ["image_reader", "ocr"], timeout: 10000 },
      { name: "Feature Extraction", type: "deterministic", agent: null, tools: [], timeout: 2000 },
      { name: "Copy Generation", type: "small_llm", agent: null, tools: ["Mistral 7B"], timeout: 8000 },
      { name: "Quality Check", type: "advanced_reasoning", agent: "Critic", tools: ["fact_checker"], timeout: 5000 },
    ],
  },
  {
    id: "WF-005", name: "Demand Forecasting", description: "Pure ML pipeline — zero LLM calls",
    steps: [
      { name: "Data Loading", type: "deterministic", agent: "SQL Agent", tools: ["sql_executor"], timeout: 5000 },
      { name: "Feature Engineering", type: "deterministic", agent: null, tools: ["python_repl"], timeout: 8000 },
      { name: "Model Training", type: "statistical", agent: "Forecasting Agent", tools: ["XGBoost", "Prophet"], timeout: 30000 },
      { name: "Validation", type: "statistical", agent: null, tools: [], timeout: 5000 },
      { name: "Output", type: "deterministic", agent: null, tools: ["chart_renderer"], timeout: 2000 },
    ],
  },
  {
    id: "WF-006", name: "Route Optimization", description: "Mathematical optimization — pure L0",
    steps: [
      { name: "Problem Formulation", type: "deterministic", agent: "Route Optimizer", tools: ["optimizer"], timeout: 2000 },
      { name: "Solve VRP", type: "deterministic", agent: null, tools: ["OR-Tools"], timeout: 15000 },
      { name: "Output Routes", type: "deterministic", agent: null, tools: ["chart_renderer"], timeout: 2000 },
    ],
  },
];

export default function WorkflowsPage() {
  const [selected, setSelected] = React.useState(WORKFLOWS[0].id);
  const workflow = WORKFLOWS.find((w) => w.id === selected)!;

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Registry</div>
          <h1 className="section-title mb-4">Workflow <em>Templates</em></h1>
          <p className="section-desc">
            Pre-built workflow patterns for common intelligence tasks. Click to inspect node configuration.
          </p>
        </div>

        <div className="grid grid-cols-[300px_1fr] gap-6">
          {/* Workflow List */}
          <div className="space-y-0.5">
            {WORKFLOWS.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelected(w.id)}
                className={`w-full text-left p-4 border transition-colors ${
                  selected === w.id
                    ? "border-gold/30 bg-gold-pale"
                    : "border-border bg-deep hover:bg-surface"
                }`}
              >
                <div className="font-mono text-[8px] tracking-[0.15em] uppercase text-gold mb-1">{w.id}</div>
                <div className="text-sm text-ivory font-light mb-1">{w.name}</div>
                <div className="text-[11px] text-ivory-faint">{w.description}</div>
                <div className="mt-2 font-mono text-[9px] text-ivory-faint">{w.steps.length} steps</div>
              </button>
            ))}
          </div>

          {/* Workflow Detail */}
          <Panel title={`${workflow.name} — ${workflow.steps.length} Steps`}>
            <div className="space-y-0">
              {workflow.steps.map((step, i) => (
                <div key={i}>
                  <div className="grid grid-cols-[60px_1fr_180px_120px] border border-border bg-void">
                    <div className="px-3 py-3 border-r border-border flex items-center justify-center">
                      <span className="font-mono text-[10px] text-gold">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-xs text-ivory font-light">{step.name}</div>
                      {step.agent && <div className="font-mono text-[9px] text-ivory-faint mt-0.5">{step.agent}</div>}
                    </div>
                    <div className="px-4 py-3 border-l border-border flex items-center">
                      <Badge strategy={step.type} variant="strategy">{step.type}</Badge>
                    </div>
                    <div className="px-4 py-3 border-l border-border flex items-center">
                      <div className="flex flex-wrap gap-1">
                        {step.tools.map((t) => (
                          <span key={t} className="font-mono text-[7px] text-ivory-faint border border-border px-1 py-0.5">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {i < workflow.steps.length - 1 && (
                    <div className="text-center py-1 bg-void border-x border-border font-mono text-[10px] text-gold-dim">↓</div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
