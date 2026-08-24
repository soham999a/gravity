"use client";

import * as React from "react";
import { SectionBlock, Panel } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";

const PROFILING_STEPS = [
  { name: "Sampling", desc: "Extracting representative sample from input" },
  { name: "Measuring", desc: "Computing statistical signals and metrics" },
  { name: "Profiling", desc: "Classifying data type and estimating complexity" },
  { name: "Complete", desc: "Problem profile generated for the IDL" },
];

interface ProfileSignal {
  name: string;
  value: number;
  unit?: string;
}

interface ProfileDimension {
  name: string;
  score: number;
  maxScore: number;
}

interface LiveProfile {
  dataType: string;
  complexity: string;
  domain: string;
  signals: ProfileSignal[];
  dimensions: ProfileDimension[];
  summary: string;
}

const EXAMPLE_PROMPTS = [
  "Analyse 124,000 sales records from the last 18 months to find the cause of declining revenue",
  "Summarise these 50 customer complaints into key themes",
  "Architect a real-time fraud detection system processing 2M transactions daily with sub-100ms decisioning",
  "Forecast demand for next quarter using historical weekly data with strong seasonality",
];

export default function ProfilerPage() {
  const [prompt, setPrompt] = React.useState(EXAMPLE_PROMPTS[0]);
  const [profiling, setProfiling] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(-1);
  const [profile, setProfile] = React.useState<LiveProfile | null>(null);

  const startProfiling = async () => {
    if (!prompt.trim() || profiling) return;
    setProfiling(true);
    setCurrentStep(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < PROFILING_STEPS.length) setCurrentStep(i);
      else clearInterval(interval);
    }, 450);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      // hold the final step briefly so the animation completes
      setTimeout(() => {
        if (json?.live) setProfile(json.profile);
        setProfiling(false);
        clearInterval(interval);
        setCurrentStep(PROFILING_STEPS.length - 1);
      }, Math.max(0, (PROFILING_STEPS.length - currentStep - 1) * 450 + 300));
    } catch {
      setProfiling(false);
      clearInterval(interval);
    }
  };

  const signals: ProfileSignal[] = profile?.signals ?? [];

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Intelligence · Live</div>
          <h1 className="section-title mb-4">Problem <em>Profiler</em></h1>
          <p className="section-desc">
            Before any routing decision, GRAVITY inspects the problem statement to understand what intelligence it needs. This is the real profiler — type any problem.
          </p>
        </div>

        {/* Prompt Input */}
        <div className="mb-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="Describe a problem to profile…"
            className="w-full bg-deep border border-border px-4 py-3 text-sm text-ivory font-light placeholder:text-ivory-faint focus:outline-none focus:border-gold/40 resize-none"
          />
        </div>
        <div className="flex gap-2 mb-8 flex-wrap items-center">
          {EXAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => { setPrompt(p); setProfile(null); setCurrentStep(-1); }}
              className={`px-3 py-1.5 font-mono text-[8px] tracking-[0.08em] uppercase border transition-colors ${
                prompt === p
                  ? "border-gold text-gold bg-gold-pale"
                  : "border-border text-ivory-faint hover:border-border-light"
              }`}
            >
              Example {i + 1}
            </button>
          ))}
          <Button onClick={startProfiling} disabled={profiling} className="ml-auto">
            {profiling ? "Profiling..." : "Start Profiling"}
          </Button>
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

            {profile && (
              <div className="p-4 border border-border bg-void">
                <div className="kicker-gold mb-2">Problem Profile</div>
                <div className="text-xs text-ivory-dim font-light leading-relaxed">
                  Domain: <span className="text-gold">{profile.domain}</span>. Data type: <span className="text-gold">{profile.dataType}</span>.
                  Complexity: <span className="text-gold">{profile.complexity}</span>.
                </div>
                <div className="mt-4 space-y-2">
                  {profile.dimensions.map((d) => (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="font-mono text-[8px] tracking-[0.1em] uppercase text-ivory-faint w-[140px]">{d.name}</span>
                      <div className="flex-1 h-1.5 bg-border">
                        <div className="h-full bg-gold/60" style={{ width: `${(d.score / d.maxScore) * 100}%` }} />
                      </div>
                      <span className="font-mono text-[9px] text-ivory-dim w-8 text-right">{d.score}/{d.maxScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Signals */}
          <Panel title="Measured Signals">
            {!profile ? (
              <p className="text-[13px] text-ivory-faint italic">Run the profiler on a problem to see its live signal measurements.</p>
            ) : (
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
                      <div className="h-full bg-gold/60 transition-all duration-700" style={{ width: `${Math.min((s.value / (s.value > 1 ? s.value * 1.2 : 1)) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
