"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ClassId = "A" | "B" | "C" | "D" | "E";

interface ClassDef {
  id: ClassId;
  title: string;
  examples: string;
  claim: string;
  expect: { levels: number[]; shape: string; liveModel: boolean };
}

interface Receipt {
  classId: ClassId;
  status: "PASS" | "FAIL";
  verdict: string;
  missionId: string;
  durationMs: number;
  routing: {
    selectedLabel: string;
    selectedLevel: number;
    policy: string;
    explorationState: string;
    mode: string;
    confidence: number;
    rationale: string[];
  };
  execution: {
    status: string;
    tokens: number;
    llmCalls: number;
    stepCount: number;
    steps: { name: string; stage: string | null; status: string; tokens: number }[];
  };
  evaluation: { verdict: string; quality: number; judgeUsed: boolean };
  answer: string;
  adaptation: { regimeShift: boolean; explorationBoost: number; observations: number } | null;
}

interface RunState {
  phase: "idle" | "running" | "done" | "error";
  receipt?: Receipt;
  message?: string;
}

const CLASS_TONE: Record<ClassId, string> = {
  A: "text-gold",
  B: "text-success-text",
  C: "text-ivory",
  D: "text-chart-4",
  E: "text-danger-text",
};

export default function ClassesPage() {
  const [defs, setDefs] = React.useState<ClassDef[]>([]);
  const [runs, setRuns] = React.useState<Partial<Record<ClassId, RunState>>>({});
  const [open, setOpen] = React.useState<ClassId | null>(null);
  const [runAll, setRunAll] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/classes")
      .then((res) => res.json())
      .then((data: { classes: ClassDef[] }) => setDefs(data.classes ?? []))
      .catch(() => setDefs([]));
  }, []);

  const runClass = React.useCallback(async (id: ClassId) => {
    setRuns((current) => ({ ...current, [id]: { phase: "running" } }));
    setOpen(id);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "run failed");
      setRuns((current) => ({ ...current, [id]: { phase: "done", receipt: data.receipt } }));
    } catch (err) {
      setRuns((current) => ({
        ...current,
        [id]: {
          phase: "error",
          message: err instanceof Error ? err.message : "run failed",
        },
      }));
    }
  }, []);

  const runAllClasses = React.useCallback(async () => {
    setRunAll(true);
    for (const def of defs) {
      await runClass(def.id);
    }
    setRunAll(false);
  }, [defs, runClass]);

  const done = Object.values(runs).filter((state) => state?.phase === "done").length;
  const passed = Object.values(runs).filter(
    (state) => state?.phase === "done" && state.receipt?.status === "PASS",
  ).length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10">
      {/* Page header — our PageHeader pattern, rebuilt on his tokens */}
      <header className="space-y-3">
        <p className="meta">05 / Benchmarks</p>
        <h1 className="font-sans text-2xl font-light tracking-wide text-ivory">
          THE FIVE WORKLOAD CLASSES
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-ivory-faint">
          One test per class, each proving a different architectural claim. A test passes when the
          system did the structurally correct thing — the right level, the right tokens, the right
          adaptation — not merely when the answer looks right.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            className="studio-primary-button px-4 py-2"
            onClick={runAllClasses}
            disabled={runAll || defs.length === 0}
          >
            {runAll ? "Running battery…" : "Run all five"}
          </button>
          <span className="meta">
            {passed}/{done || 0} passed · runs the live Gemini-powered pipeline
          </span>
        </div>
      </header>

      {/* Scoreboard */}
      <section className="border border-border bg-surface/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="meta">Scoreboard</p>
          <p className="meta">{done}/5 executed</p>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {defs.map((def) => {
            const state = runs[def.id];
            const receipt = state?.receipt;
            return (
              <div
                key={def.id}
                className={cn(
                  "border px-3 py-4 text-center",
                  receipt?.status === "PASS" && "border-success/60",
                  receipt?.status === "FAIL" && "border-danger/60",
                  !receipt && "border-border",
                )}
              >
                <p className={cn("font-mono text-xl", CLASS_TONE[def.id])}>{def.id}</p>
                <p className="meta mt-1 truncate" title={def.title}>
                  {def.title}
                </p>
                <p className="mt-2 font-mono text-xs">
                  {state?.phase === "running" ? (
                    <span className="animate-pulse text-gold">…</span>
                  ) : receipt ? (
                    <span className={receipt.status === "PASS" ? "text-success-text" : "text-danger-text"}>
                      {receipt.status}
                    </span>
                  ) : state?.phase === "error" ? (
                    <span className="text-danger-text">ERROR</span>
                  ) : (
                    <span className="text-ivory-faint">—</span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
        {done === 5 ? (
          <p className="meta mt-4 text-center">
            {passed}/5 classes passed — routing, allocation, and orchestration proven live.
          </p>
        ) : null}
      </section>

      {/* Per-class sections with receipts */}
      <div className="space-y-4">
        {defs.map((def, index) => {
          const state = runs[def.id];
          const receipt = state?.receipt;
          const expanded = open === def.id;
          return (
            <section key={def.id} className="border border-border bg-surface/40">
              <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className={cn("font-mono text-sm", CLASS_TONE[def.id])}>{def.id}</span>
                    <h2 className="font-sans text-sm font-medium tracking-wide text-ivory">
                      {def.title}
                    </h2>
                  </div>
                  <p className="meta mt-1">{def.examples}</p>
                  <p className="mt-2 max-w-3xl text-xs leading-relaxed text-ivory-faint">
                    {def.claim}
                  </p>
                </div>
                <button
                  type="button"
                  className="studio-primary-button shrink-0 px-4 py-2"
                  disabled={state?.phase === "running"}
                  onClick={() => runClass(def.id)}
                >
                  {state?.phase === "running" ? "Running…" : "Run test"}
                </button>
              </div>

              {state?.phase === "error" ? (
                <p className="border-t border-danger/40 bg-danger/5 px-5 py-3 font-mono text-xs text-danger-text">
                  {state.message}
                </p>
              ) : null}

              {receipt ? (
                <div className="border-t border-border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
                    onClick={() => setOpen(expanded ? null : def.id)}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "font-mono text-xs",
                          receipt.status === "PASS" ? "text-success-text" : "text-danger-text",
                        )}
                      >
                        {receipt.status === "PASS" ? "✓" : "✗"}
                      </span>
                      <span
                        className={cn(
                          "truncate font-mono text-xs",
                          receipt.status === "PASS" ? "text-success-text" : "text-danger-text",
                        )}
                      >
                        {receipt.verdict}
                      </span>
                    </span>
                    <span className="meta">{expanded ? "collapse" : "expand"}</span>
                  </button>

                  {expanded ? (
                    <div className="space-y-5 border-t border-border/60 px-5 py-4">
                      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                        <Stat label="Route" value={receipt.routing.selectedLabel} sub={`Level ${receipt.routing.selectedLevel} · ${receipt.routing.policy}`} />
                        <Stat label="Tokens" value={String(receipt.execution.tokens)} sub={`${receipt.execution.llmCalls} LLM call(s)`} />
                        <Stat label="Judge" value={receipt.evaluation.verdict} sub={`quality ${Math.round(receipt.evaluation.quality * 100)}`} />
                        <Stat label="Steps" value={String(receipt.execution.stepCount)} sub={receipt.execution.status} />
                        <Stat label="End-to-end" value={`${receipt.durationMs}ms`} sub={`confidence ${Math.round(receipt.routing.confidence * 100)}%`} />
                      </div>

                      <div>
                        <p className="meta">Answer</p>
                        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap border border-border/60 bg-surface-2/40 p-3 font-mono text-xs leading-relaxed text-ivory">
                          {receipt.answer || "—"}
                        </pre>
                      </div>

                      <div>
                        <p className="meta">Execution steps</p>
                        <ol className="mt-2 space-y-1.5">
                          {receipt.execution.steps.map((step, i) => (
                            <li key={i} className="flex gap-3 font-mono text-xs">
                              <span className="w-40 shrink-0 truncate text-gold">{step.name}</span>
                              <span className="w-36 shrink-0 text-ivory-faint">{step.stage ?? "—"}</span>
                              <span
                                className={cn(
                                  "w-24 shrink-0",
                                  step.status === "completed" ? "text-success-text" : "text-danger-text",
                                )}
                              >
                                {step.status}
                              </span>
                              <span className="text-ivory-faint">{step.tokens} tok</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <details className="font-mono text-xs text-ivory-faint">
                        <summary className="cursor-pointer select-none">
                          Why this route was chosen ({receipt.routing.rationale.length} reasons)
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {receipt.routing.rationale.map((reason, i) => (
                            <li key={i}>· {reason}</li>
                          ))}
                        </ul>
                        {receipt.adaptation ? (
                          <p className="mt-2">
                            adaptation: regimeShift={String(receipt.adaptation.regimeShift)} ·
                            explorationBoost={receipt.adaptation.explorationBoost.toFixed(2)} ·
                            observations={receipt.adaptation.observations}
                          </p>
                        ) : null}
                      </details>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {index === defs.length - 1 ? (
                <p className="meta border-t border-border px-5 py-3">
                  Structural claim under test: advantages come from routing, allocation, and
                  orchestration — not from model choice alone.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-border/60 px-3 py-2">
      <p className="meta">{label}</p>
      <p className="mt-1 truncate font-mono text-sm text-ivory" title={value}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 truncate font-mono text-[0.7rem] text-ivory-faint">{sub}</p> : null}
    </div>
  );
}
