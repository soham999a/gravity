"use client";

import * as React from "react";
import { SectionBlock, Panel, Bar, StatusDot, KeyValue } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Zap, ArrowRight, Shield, Brain, DollarSign, Clock, Target, CheckCircle2, ArrowUp, ArrowDown, Minus } from "lucide-react";

const SAMPLE_MISSIONS = [
  {
    title: "Retail Sales Decline",
    prompt: "Analyse a retail company experiencing a 12% decline in quarterly sales and recommend a data-driven recovery strategy.",
    strategy: "Multi-Agent Deliberation",
    strategyType: "multi" as const,
    levels: ["L0 SQL analytics", "L1 XGBoost forecasting", "L5 Multi-agent analysis"],
    cost: "$0.034",
    latency: "34s",
  },
  {
    title: "Demand Forecasting",
    prompt: "Forecast demand for the next 30 days based on 18 months of historical sales data.",
    strategy: "Statistical / ML",
    strategyType: "statistical" as const,
    levels: ["L0 SQL aggregation", "L1 Prophet + XGBoost ensemble"],
    cost: "$0.00",
    latency: "8s",
  },
  {
    title: "Complaint Clustering",
    prompt: "Summarise 50 customer complaints into structured insight clusters.",
    strategy: "Compression + Small LLM",
    strategyType: "small_llm" as const,
    levels: ["L0 Dedup + embed", "L2 Cluster + sample", "L2 Mistral synthesis"],
    cost: "$0.003",
    latency: "12s",
  },
  {
    title: "Route Optimisation",
    prompt: "Optimise delivery routes for 150 stops across 3 vehicles.",
    strategy: "Deterministic",
    strategyType: "deterministic" as const,
    levels: ["L0 OR-Tools vehicle routing"],
    cost: "$0.00",
    latency: "0.4s",
  },
  {
    title: "Transaction Anomalies",
    prompt: "Detect anomalies in the last 10,000 transactions.",
    strategy: "Statistical / ML",
    strategyType: "statistical" as const,
    levels: ["L0 SQL window functions", "L1 Isolation Forest"],
    cost: "$0.00",
    latency: "3s",
  },
];

const PRINCIPLES = [
  "Optimal Intelligence = f(Quality, Cost, Latency, Risk, Complexity)",
  "The objective is not maximum intelligence. It is optimal intelligence.",
  "GRAVITY may deliberately spend zero LLM tokens when deterministic computation is sufficient.",
  "Every execution produces a feedback signal that feeds into future routing decisions.",
  "The Escalation Ladder starts at L0 and climbs only when each level is demonstrably insufficient.",
];

export default function GravityControl() {
  const [selectedMission, setSelectedMission] = React.useState<number | null>(null);
  const [running, setRunning] = React.useState(false);
  const [phase, setPhase] = React.useState(0);
  const [showResult, setShowResult] = React.useState(false);

  const phases = [
    { name: "Mission Received", detail: "Parsing intent, extracting data requirements, classifying domain." },
    { name: "Problem Profiling", detail: "Data type: time_series + text. Complexity: HIGH. Risk: MEDIUM. Semantic: analytical + creative." },
    { name: "Intelligence Routing", detail: "8 candidates evaluated. VoI analysis: multi-agent required for strategic depth." },
    { name: "Strategy Selected", detail: "Multi-Agent Deliberation — Planner + 3 Specialists + Critic + Synthesiser." },
    { name: "Execution", detail: "Pipeline nodes active. L0 SQL: 0.3s. L1 XGBoost: 4.2s. L5 Agents: 28.1s." },
    { name: "Evaluation", detail: "Confidence: 0.87. Quality: 0.82. Cost efficiency: 94%. All thresholds met." },
    { name: "Result Ready", detail: "Decision Ledger entry created. Feedback signal stored. Mission complete." },
  ];

  const currentMission = selectedMission !== null ? SAMPLE_MISSIONS[selectedMission] : null;

  const runDemo = (idx: number) => {
    setSelectedMission(idx);
    setRunning(true);
    setPhase(0);
    setShowResult(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < phases.length) {
        setPhase(i);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setRunning(false);
          setShowResult(true);
        }, 800);
      }
    }, 900);
  };

  return (
    <div>
      {/* Cover */}
      <SectionBlock className="!py-0 !px-0 !border-0">
        <div className="relative min-h-[80vh] flex flex-col justify-end pb-16 px-8 lg:px-20">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }} />
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse at 75% 30%, rgba(184,150,12,0.05) 0%, transparent 55%)",
          }} />
          <div className="relative z-10">
            <div className="flex items-center gap-3.5 mb-9">
              <div className="gold-rule" />
              <span className="kicker-gold">MATRIX Intelligence Infrastructure — New Platform</span>
            </div>
            <h1 className="font-serif text-[clamp(72px,11vw,148px)] font-light leading-[0.92] tracking-tight text-ivory mb-5">
              GRA<span className="text-gold">V</span>ITY
            </h1>
            <p className="text-xs font-light tracking-[0.18em] uppercase text-ivory-faint mb-14">
              Adaptive Intelligence Allocation Framework
            </p>

            {/* Core Equation */}
            <div className="border border-border-light bg-gold-pale2 p-6 max-w-[700px] mb-14">
              <div className="kicker-gold mb-3">Core Equation</div>
              <div className="font-serif text-xl font-light text-ivory leading-relaxed">
                <em className="text-gold italic">Optimal Intelligence</em> = f(Quality, Cost, Latency, Risk, Complexity)
              </div>
              <p className="text-[13px] text-ivory-faint mt-2">
                The objective is not maximum intelligence. It is optimal intelligence.
              </p>
            </div>

            {/* Meta */}
            <div className="flex gap-0 border-t border-border pt-7 flex-wrap">
              {[
                { label: "Classification", value: "Technology Platform — Concept" },
                { label: "Status", value: "Architecture Draft Phase 0" },
                { label: "Author", value: "Somnath Banerjee MATRIX" },
                { label: "Date", value: "August 2026" },
              ].map((m, i) => (
                <div key={i} className="pr-9 mr-9 border-r border-border last:border-0 last:pr-0 last:mr-0">
                  <div className="kicker mb-1">{m.label}</div>
                  <div className="text-[13px] text-ivory">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionBlock>

      {/* Why GRAVITY */}
      <SectionBlock>
        <div className="grid grid-cols-[140px_1fr] gap-12 mb-16 pb-10 border-b border-border">
          <div><span className="section-number">01</span></div>
          <div>
            <div className="kicker mb-3">Motivation</div>
            <h2 className="section-title mb-4">Why <em>GRAVITY</em></h2>
            <p className="section-desc">
              The market produces frameworks that orchestrate agents. GRAVITY asks a prior question:
              what form of computation is actually appropriate for this problem instance?
            </p>
          </div>
        </div>

        <div className="grid-3 mb-8">
          <div>
            <h4 className="font-mono text-[9px] tracking-[0.2em] uppercase text-danger-text mb-2">The Current Mistake</h4>
            <p className="text-sm text-ivory-dim leading-relaxed">
              Most agentic systems default to LLM reasoning for every task. This is expensive, slow, and fragile —
              because the majority of enterprise tasks are deterministic, statistical, or require only a small model.
            </p>
          </div>
          <div>
            <h4 className="font-mono text-[9px] tracking-[0.2em] uppercase text-warning-text mb-2">The Research Signal</h4>
            <p className="text-sm text-ivory-dim leading-relaxed">
              RouteLLM and related work demonstrate that a learned router can reduce LLM API cost by 40-60%
              while maintaining benchmark quality. The router itself need not be an LLM.
            </p>
          </div>
          <div>
            <h4 className="font-mono text-[9px] tracking-[0.2em] uppercase text-gold mb-2">The GRAVITY Answer</h4>
            <p className="text-sm text-ivory-dim leading-relaxed">
              An adaptive intelligence allocation system that assigns the minimum sufficient form of computation
              to each task — and evolves its routing from rules toward learned decisions over time.
            </p>
          </div>
        </div>

        {/* Core Principle */}
        <div className="text-center border border-border bg-deep p-12 my-9">
          <div className="mb-8 pb-7 border-b border-border">
            <div className="kicker mb-3" style={{ color: "var(--color-danger-text)" }}>Conventional AI Thinking — Incorrect</div>
            <div className="font-serif text-xl font-light text-ivory-faint line-through" style={{ textDecorationColor: "var(--color-danger)" }}>
              More intelligence leads to a better result
            </div>
          </div>
          <div className="kicker-gold mb-3.5">GRAVITY Principle — Correct</div>
          <div className="font-serif text-[clamp(18px,2.5vw,26px)] font-light text-ivory leading-normal">
            <em className="text-gold italic">Optimal Intelligence</em> = f(<em className="text-gold italic">Quality</em> × <em className="text-gold italic">Reliability</em> × <em className="text-gold italic">Latency</em> × <em className="text-gold italic">Cost</em> × <em className="text-gold italic">Risk</em>)
          </div>
          <p className="text-[13px] text-ivory-faint mt-6 max-w-2xl mx-auto">
            The objective is not maximum intelligence. GRAVITY may deliberately spend{" "}
            <span className="text-success-text">zero LLM tokens</span> when deterministic computation is sufficient.
            It may spend <span className="text-gold">more tokens</span> when the expected improvement justifies the cost.
          </p>
        </div>

        {/* Philosophy */}
        <div className="text-center border border-border bg-gold-pale2 py-16 px-10 my-9">
          <div className="font-serif text-[clamp(20px,3.5vw,36px)] font-light text-ivory leading-snug mb-1.5">
            Algorithms where algorithms win.
          </div>
          <div className="font-serif text-[clamp(20px,3.5vw,36px)] font-light text-ivory leading-snug mb-1.5">
            Statistics where statistics win.
          </div>
          <div className="font-serif text-[clamp(20px,3.5vw,36px)] font-light text-ivory leading-snug mb-1.5">
            Models where models win.
          </div>
          <div className="font-serif text-[clamp(20px,3.5vw,36px)] font-light text-ivory leading-snug mb-1.5">
            Agents where <em className="text-gold italic">reasoning</em> is required.
          </div>
          <div className="font-serif text-[clamp(20px,3.5vw,36px)] font-light text-ivory leading-snug mb-1.5">
            Multi-agent where complexity demands it.
          </div>
          <div className="font-serif text-[clamp(20px,3.5vw,36px)] font-light text-ivory leading-snug mb-7">
            Humans where <em className="text-gold italic">judgment</em> matters.
          </div>
          <div className="gold-rule mx-auto mb-7" />
          <div className="kicker">The GRAVITY Engineering Philosophy</div>
        </div>
      </SectionBlock>

      {/* Interactive Demo */}
      <SectionBlock>
        <div className="grid grid-cols-[140px_1fr] gap-12 mb-16 pb-10 border-b border-border">
          <div><span className="section-number">Demo</span></div>
          <div>
            <div className="kicker mb-3">Demonstration</div>
            <h2 className="section-title mb-4">Intelligence <em>Mission</em></h2>
            <p className="section-desc">
              Select a mission to watch GRAVITY route it through the optimal intelligence pathway —
              from problem profiling to execution to evaluation.
            </p>
          </div>
        </div>

        <div className="border border-border bg-deep overflow-hidden">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block" />
              <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-ivory">
                GRAVITY Execution Engine
              </span>
            </div>
            <span className="font-mono text-[8px] tracking-[0.1em] text-ivory-faint">
              LOCAL · OLLAMA · ZERO API COST
            </span>
          </div>
          <div className="p-8">
            {/* Mission Cards */}
            {!running && !showResult && (
              <div>
                <div className="kicker mb-4">Select a Mission to Execute</div>
                <div className="grid grid-cols-1 gap-3">
                  {SAMPLE_MISSIONS.map((m, i) => (
                    <button
                      key={i}
                      onClick={() => runDemo(i)}
                      className="w-full text-left p-5 border border-border bg-void hover:border-gold/30 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-serif text-base text-ivory group-hover:text-gold transition-colors">{m.title}</div>
                        <Badge strategy={m.strategyType}>{m.strategy}</Badge>
                      </div>
                      <div className="text-[12px] text-ivory-faint mb-3 leading-relaxed">{m.prompt}</div>
                      <div className="flex gap-4 font-mono text-[9px] text-ivory-faint">
                        <span>Cost: <span className="text-gold">{m.cost}</span></span>
                        <span>Latency: <span className="text-gold">{m.latency}</span></span>
                        <span>Levels: {m.levels.length}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Execution Pipeline */}
            {running && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="kicker mb-0">Execution Trace — {currentMission?.title}</div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 border border-border-light border-t-gold rounded-full animate-spin" />
                    <span className="font-mono text-[9px] text-gold">Running</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  {phases.map((p, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-[160px_1fr_100px] border transition-all duration-300 ${
                        i < phase
                          ? "opacity-100 border-success/20 bg-success/5"
                          : i === phase
                            ? "opacity-100 border-gold/30 bg-gold-pale"
                            : "opacity-30 border-border bg-void"
                      }`}
                    >
                      <div className="px-4 py-3 bg-surface border-r border-border font-mono text-[8px] tracking-[0.12em] uppercase text-ivory-faint flex items-center">
                        {p.name}
                      </div>
                      <div className="px-4 py-3 text-[11px] text-ivory-dim flex items-center">
                        {i <= phase ? p.detail : <span className="text-ivory-faint/40">Waiting...</span>}
                      </div>
                      <div className="px-4 py-3 flex items-center justify-end">
                        {i < phase ? (
                          <CheckCircle2 size={14} className="text-success-text" />
                        ) : i === phase ? (
                          <div className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Strategy Path */}
                <div className="mt-6 p-4 border border-border bg-void">
                  <div className="kicker-gold mb-3">Intelligence Path</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentMission?.levels.map((l, i) => (
                      <React.Fragment key={i}>
                        <span className="px-3 py-1.5 border border-gold/20 bg-gold-pale font-mono text-[9px] text-gold">
                          {l}
                        </span>
                        {i < currentMission.levels.length - 1 && (
                          <ArrowRight size={12} className="text-gold/40" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Result */}
            {showResult && currentMission && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="kicker mb-0">Result — {currentMission.title}</div>
                  <button
                    onClick={() => { setShowResult(false); setSelectedMission(null); setPhase(0); }}
                    className="font-mono text-[9px] tracking-[0.12em] uppercase text-gold hover:text-gold/80 transition-colors"
                  >
                    Run Another →
                  </button>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Strategy", value: currentMission.strategy, color: "text-gold" },
                    { label: "Total Cost", value: currentMission.cost, color: currentMission.cost === "$0.00" ? "text-success-text" : "text-gold" },
                    { label: "Total Latency", value: currentMission.latency, color: "text-ivory" },
                    { label: "Confidence", value: "0.87", color: "text-success-text" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="p-4 border border-border bg-void text-center">
                      <div className="kicker mb-1">{kpi.label}</div>
                      <div className={`font-serif text-xl ${kpi.color}`}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {/* Decision Breakdown */}
                <div className="mb-6">
                  <div className="kicker mb-3">Decision Breakdown</div>
                  <div className="space-y-2">
                    {currentMission.levels.map((l, i) => (
                      <div key={i} className="grid grid-cols-[50px_1fr_100px_100px] border border-border bg-void">
                        <div className="px-3 py-2.5 border-r border-border flex items-center justify-center">
                          <span className="font-mono text-[10px] text-gold">L{i}</span>
                        </div>
                        <div className="px-4 py-2.5 text-[11px] text-ivory-dim flex items-center">{l}</div>
                        <div className="px-3 py-2.5 border-l border-border flex items-center justify-center">
                          <span className="font-mono text-[10px] text-success-text">
                            {currentMission.cost === "$0.00" ? "$0.00" : `$${(parseFloat(currentMission.cost.replace("$", "")) / currentMission.levels.length).toFixed(3)}`}
                          </span>
                        </div>
                        <div className="px-3 py-2.5 border-l border-border flex items-center justify-center">
                          <CheckCircle2 size={12} className="text-success-text" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evaluation */}
                <div className="p-5 border border-border bg-void">
                  <div className="kicker-gold mb-3">Evaluation Summary</div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-[11px] text-ivory-faint mb-2">Output Quality</div>
                      <Bar value={82} label="0.82" />
                    </div>
                    <div>
                      <div className="text-[11px] text-ivory-faint mb-2">Cost Efficiency</div>
                      <Bar value={94} label="94%" color="var(--color-success-text)" />
                    </div>
                  </div>
                  <p className="text-[11px] text-ivory-dim mt-4 leading-relaxed">
                    {currentMission.title === "Retail Sales Decline" &&
                      "Multi-agent deliberation produced a comprehensive recovery strategy. SQL analytics identified the root cause (seasonal decline in 2 product categories). XGBoost forecasting projected continued decline without intervention. Three specialist agents researched market conditions, competitor strategies, and customer sentiment. The synthesiser produced a prioritised 90-day recovery plan."}
                    {currentMission.title === "Demand Forecasting" &&
                      "No LLM tokens spent. Prophet and XGBoost ensemble produced 30-day forecast with 93% accuracy on holdout data. Deterministic SQL aggregation computed historical baselines."}
                    {currentMission.title === "Complaint Clustering" &&
                      "50 documents compressed to 5 representatives via Nomic Embed clustering. Local Mistral 7B synthesised insights from 5k tokens instead of 50k. 98% cost reduction vs naive approach."}
                    {currentMission.title === "Route Optimisation" &&
                      "Pure deterministic computation. OR-Tools vehicle routing solver optimised 150 stops across 3 vehicles. No LLM required. 100% exact solution."}
                    {currentMission.title === "Transaction Anomalies" &&
                      "SQL window functions computed rolling statistics. Isolation Forest flagged 23 anomalies from 10k transactions. No LLM required for this statistical task."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product Principles */}
        <div className="mt-12">
          <h3 className="font-serif text-2xl font-normal text-ivory mb-6">Operating Principles</h3>
          <div className="space-y-2">
            {PRINCIPLES.map((p, i) => (
              <div key={i} className="p-4 border border-border bg-deep flex items-start gap-3">
                <span className="font-mono text-[9px] text-gold mt-0.5">~</span>
                <span className="text-[13px] text-ivory-dim font-light">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
