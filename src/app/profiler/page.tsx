"use client";

import * as React from "react";
import { SectionBlock, Panel } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";

const DATA_TYPES = ["structured", "text", "documents", "images", "time_series", "mixed", "unknown"] as const;

const PROFILING_STEPS = [
  { name: "Sampling", desc: "Extracting representative sample from input" },
  { name: "Measuring", desc: "Computing statistical signals and metrics" },
  { name: "Profiling", desc: "Classifying data type and estimating complexity" },
  { name: "Complete", desc: "Problem profile generated for the IDL" },
];

const SIGNALS: Record<string, { name: string; value: number; unit: string }[]> = {
  structured: [
    { name: "Records", value: 124000, unit: "" },
    { name: "Features", value: 18, unit: "" },
    { name: "Missingness", value: 2.1, unit: "%" },
    { name: "Variance", value: 0.73, unit: "" },
    { name: "Correlation Strength", value: 0.82, unit: "" },
    { name: "Semantic Complexity", value: 0.12, unit: "" },
  ],
  text: [
    { name: "Documents", value: 50, unit: "" },
    { name: "Avg Length", value: 2400, unit: "chars" },
    { name: "Semantic Diversity", value: 0.78, unit: "" },
    { name: "Duplication Rate", value: 12, unit: "%" },
    { name: "Classification Difficulty", value: 0.65, unit: "" },
  ],
  documents: [
    { name: "Documents", value: 50, unit: "" },
    { name: "Avg Length", value: 3200, unit: "chars" },
    { name: "Semantic Diversity", value: 0.82, unit: "" },
    { name: "Topic Clusters", value: 5, unit: "" },
    { name: "Duplication Rate", value: 18, unit: "%" },
  ],
  images: [
    { name: "Images", value: 12, unit: "" },
    { name: "Avg Size", value: 2.4, unit: "MB" },
    { name: "Resolution", value: 1920, unit: "px" },
    { name: "Has Text", value: 0.67, unit: "" },
  ],
  time_series: [
    { name: "Data Points", value: 52000, unit: "" },
    { name: "Time Span", value: 18, unit: "months" },
    { name: "Frequency", value: 1, unit: "daily" },
    { name: "Seasonality", value: 0.85, unit: "" },
    { name: "Trend Strength", value: 0.62, unit: "" },
  ],
  mixed: [
    { name: "Modalities", value: 3, unit: "" },
    { name: "Structured Records", value: 10000, unit: "" },
    { name: "Text Documents", value: 200, unit: "" },
    { name: "Images", value: 50, unit: "" },
  ],
  unknown: [
    { name: "Input Size", value: 0, unit: "bytes" },
    { name: "Confidence", value: 0.1, unit: "" },
  ],
};

export default function ProfilerPage() {
  const [dataType, setDataType] = React.useState<string>("structured");
  const [profiling, setProfiling] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(-1);

  const startProfiling = () => {
    setProfiling(true);
    setCurrentStep(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < PROFILING_STEPS.length) {
        setCurrentStep(i);
      } else {
        clearInterval(interval);
        setTimeout(() => setProfiling(false), 500);
      }
    }, 1500);
  };

  const signals = SIGNALS[dataType] || SIGNALS.structured;

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Intelligence</div>
          <h1 className="section-title mb-4">Problem <em>Profiler</em></h1>
          <p className="section-desc">
            Before any routing decision, GRAVITY inspects a representative sample to understand the problem.
          </p>
        </div>

        {/* Data Type Selector */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {DATA_TYPES.map((dt) => (
            <button
              key={dt}
              onClick={() => { setDataType(dt); setCurrentStep(-1); setProfiling(false); }}
              className={`px-4 py-2 font-mono text-[9px] tracking-[0.12em] uppercase border transition-colors ${
                dataType === dt
                  ? "border-gold text-gold bg-gold-pale"
                  : "border-border text-ivory-faint hover:border-border-light"
              }`}
            >
              {dt.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-6">
          {/* Profiling Steps */}
          <Panel title="Profiling Pipeline">
            <div className="space-y-0.5 mb-6">
              {PROFILING_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[160px_1fr_100px] border transition-all duration-300 ${
                    i < currentStep
                      ? "border-success/30 opacity-100"
                      : i === currentStep
                      ? "border-gold/30 opacity-100"
                      : "border-border opacity-40"
                  }`}
                >
                  <div className="px-4 py-3 bg-surface border-r border-border font-mono text-[8px] tracking-[0.12em] uppercase text-ivory-faint flex items-center">
                    {step.name}
                  </div>
                  <div className="px-4 py-3 text-[11px] text-ivory-dim flex items-center">{step.desc}</div>
                  <div className="px-4 py-3 flex items-center justify-end">
                    {i < currentStep ? (
                      <span className="font-mono text-[10px] text-success-text">Done</span>
                    ) : i === currentStep && profiling ? (
                      <div className="w-2.5 h-2.5 border border-border-light border-t-gold rounded-full animate-spin" />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={startProfiling} disabled={profiling}>
              {profiling ? "Profiling..." : "Start Profiling"}
            </Button>
          </Panel>

          {/* Signals */}
          <Panel title="Measured Signals">
            <div className="space-y-3">
              {signals.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-ivory-faint">{s.name}</span>
                    <span className="font-mono text-[10px] text-ivory-dim">
                      {typeof s.value === "number" && s.value > 1000
                        ? s.value.toLocaleString()
                        : s.value}
                      {s.unit ? ` ${s.unit}` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 bg-border">
                    <div className="h-full bg-gold/60 transition-all" style={{ width: `${Math.min((s.value / (s.value > 1 ? s.value * 1.2 : 1)) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {currentStep >= PROFILING_STEPS.length - 1 && (
              <div className="mt-6 p-4 border border-border bg-void">
                <div className="kicker-gold mb-2">Problem Profile</div>
                <div className="text-xs text-ivory-dim font-light leading-relaxed">
                  Data type: <span className="text-gold">{dataType}</span>. Complexity: <span className="text-gold">Medium</span>.
                  Semantic reasoning required: <span className="text-gold">Low</span>. Optimal escalation: <span className="text-gold">L0-L1</span>.
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
