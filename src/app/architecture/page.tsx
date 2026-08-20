"use client";

import * as React from "react";
import { Panel } from "@/components/gravity/primitives";

const LAYERS = [
  { num: "01", name: "Task Intelligence", tagline: "Intent parsing · Profiling · Decomposition · Constraint extraction", responsibilities: ["Parse task intent and structure requirements", "Sample and profile the problem", "Estimate complexity, latency, cost constraints", "Produce a Task Descriptor object for the IDL"], technologies: ["Rule-based classifiers", "Pydantic schemas", "Statistical profiling (pandas, scipy)", "Embedding-based semantic analysis"], rationale: ["Separating understanding from execution improves routing", "Profiling prevents over-engineering", "This layer should itself use the cheapest computation"] },
  { num: "02", name: "Intelligence Decision Layer", tagline: "VoI · Adaptive Budget · Compression · Decision Ledger · Feedback", responsibilities: ["Evaluate all candidate strategies", "Score suitability, cost, latency, quality", "Select optimal strategy via VoI analysis", "Record decision in ledger", "Feed outcomes back into routing"], technologies: ["Rules → Classifiers → Learned Router", "VoI scoring engine", "Adaptive token budgeting", "Decision Ledger writer"], rationale: ["Most important layer — the brain of GRAVITY", "Closed-loop learning improves over time", "Transparency via Decision Ledger"] },
  { num: "03", name: "Workflow and Agent Orchestrator", tagline: "Sequential · Parallel · Conditional · Loops · Handoffs", responsibilities: ["Execute workflows per routing decision", "Manage agent handoffs", "Handle retries and fallbacks", "Checkpoint durable execution"], technologies: ["LangGraph (MIT)", "n8n self-hosted", "FastAPI execution API", "SQLite → PostgreSQL"], rationale: ["Reliability via retry, fallback, checkpoint", "Patterns: sequential, parallel, conditional, loops"] },
  { num: "04", name: "Tool and MCP Fabric", tagline: "MCP servers · Search · SQL · Python · Custom tools", responsibilities: ["Provide scoped tool access to agents", "Enforce permissions per agent identity", "Audit every tool invocation", "Support new tools without orchestration changes"], technologies: ["MCP protocol", "Scoped permissions", "Tool registry", "Audit logging"], rationale: ["MCP standardises tool integration", "Least-privilege per agent", "Audit trail for compliance"] },
  { num: "05", name: "Model Gateway", tagline: "Provider-agnostic · Ollama primary · LiteLLM · Optional cloud", responsibilities: ["Unified OpenAI-compatible API", "Cost tracking per request", "Retry and fallback across tiers", "Model version pinning"], technologies: ["LiteLLM proxy", "Ollama (primary)", "OpenRouter (optional)", "Commercial APIs (edge cases)"], rationale: ["Model is a component, not the architecture", "Prototype runs entirely on Ollama — zero cost", "Cloud as safety net only"] },
  { num: "06", name: "Memory and Knowledge", tagline: "Working · Episodic · Semantic · Operational state", responsibilities: ["Working memory for current task", "Episodic memory of past decisions", "Semantic knowledge base with embeddings", "Operational state for workflows"], technologies: ["ChromaDB / Qdrant (vectors)", "SQLite (state)", "GraphRAG (knowledge)", "Mem0 (memory)"], rationale: ["GraphRAG replaces naive chunk-based RAG", "Compression pipeline reduces context"] },
  { num: "07", name: "Evaluation and Observability", tagline: "Quality scores · Cost tracking · Routing eval · Ledger · Regression", responsibilities: ["Log every execution with full trace", "Score quality per output", "Track routing accuracy over time", "Regression testing with golden datasets"], technologies: ["OpenTelemetry (tracing)", "Prometheus + Grafana (metrics)", "Custom eval framework", "A/B routing evaluation"], rationale: ["Cannot improve what is not measured", "Golden datasets catch regressions", "A/B testing validates routing changes"] },
];

const PRINCIPLES = [
  "Architecture before implementation.",
  "Capabilities before services.",
  "Shared context over API calls.",
  "Knowledge over data.",
  "Events over request chains.",
  "Context mesh over tight coupling.",
  "Adaptive intelligence over static workflows.",
  "Composable capabilities over monolithic systems.",
];

export default function ArchitecturePage() {
  const [expanded, setExpanded] = React.useState<number | null>(0);

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">System Design</div>
          <h1 className="section-title mb-4">System <em>Architecture</em></h1>
          <p className="section-desc">
            Seven layers from task understanding to human control. Each layer can be evolved independently.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-6">
          {/* Layer List */}
          <div className="space-y-0.5">
            {LAYERS.map((l, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className={`w-full text-left grid grid-cols-[56px_1fr_240px] border transition-colors ${
                    expanded === i
                      ? "border-gold/30 bg-surface"
                      : "border-border bg-deep hover:bg-surface"
                  }`}
                >
                  <div className={`flex items-center justify-center border-r border-border py-5 font-mono text-[11px] ${
                    expanded === i ? "bg-gold text-void" : "text-gold"
                  }`}>
                    {l.num}
                  </div>
                  <div className="py-5 px-7">
                    <div className="font-serif text-lg text-ivory mb-0.5">{l.name}</div>
                    <div className="text-[12px] text-ivory-faint">{l.tagline}</div>
                  </div>
                  <div className="py-5 px-4 border-l border-border text-[11px] text-ivory-faint flex items-center">
                    {l.technologies[0]}
                  </div>
                </button>

                {/* Expanded Detail */}
                {expanded === i && (
                  <div className="grid grid-cols-3 gap-7 border border-t-0 border-gold/30 bg-gold-pale p-7">
                    <div>
                      <h5 className="kicker-gold mb-3">Responsibilities</h5>
                      <ul className="space-y-1">
                        {l.responsibilities.map((r, j) => (
                          <li key={j} className="text-[12px] text-ivory-dim flex items-start gap-2">
                            <span className="text-gold-dim shrink-0">--</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="kicker-gold mb-3">Technologies</h5>
                      <ul className="space-y-1">
                        {l.technologies.map((t, j) => (
                          <li key={j} className="text-[12px] text-ivory-dim flex items-start gap-2">
                            <span className="text-gold-dim shrink-0">--</span> {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="kicker-gold mb-3">Rationale</h5>
                      <ul className="space-y-1">
                        {l.rationale.map((r, j) => (
                          <li key={j} className="text-[12px] text-ivory-dim flex items-start gap-2">
                            <span className="text-gold-dim shrink-0">--</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Principles */}
          <div>
            <Panel title="Operating Principles">
              <div className="space-y-0">
                {PRINCIPLES.map((p, i) => (
                  <div key={i} className="p-3 border-b border-border last:border-0 font-mono text-[12px] text-ivory flex items-start gap-2">
                    <span className="text-gold shrink-0">{">"}</span> {p}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
