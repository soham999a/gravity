"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SystemId = "GRAVITY" | "GRAVITY-STATIC" | "GRAVITY-OPENROUTER" | "CLAUDE" | "OPENAI";

const SYSTEMS: { id: SystemId; label: string; note: string }[] = [
  { id: "GRAVITY", label: "GRAVITY", note: "adaptive kernel · full pipeline" },
  { id: "GRAVITY-STATIC", label: "GRAVITY-Static", note: "kernel pinned OFF · isolates the architecture" },
  { id: "GRAVITY-OPENROUTER", label: "GRAVITY-OpenRouter", note: "raw pinned OpenRouter model (free tier) · no kernel" },
  { id: "CLAUDE", label: "Claude", note: "anthropic/claude-sonnet-5.5 · pinned, raw" },
  { id: "OPENAI", label: "OpenAI", note: "openai/gpt-oss-120b · pinned, raw (needs credit)" },
];

interface Aggregate {
  system: string;
  workloadClass: string;
  runs: number;
  taskSuccessRate: number | null;
  p50LatencyMs: number | null;
  avgTokensPerTask: number | null;
  avgIntelligenceLevel: number | null;
  totalCost: number | null;
}

interface RecordRow {
  system: string;
  workloadClass: string;
  runMode: string;
  model: string | null;
  success: boolean;
  verificationStatus: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  intelligenceLevel: number | null;
  cost: { totalCost: number };
  benchmarkRunId: string;
}

interface Manifest {
  runId: string;
  seed: number;
  systems: string[];
  runsPerClass: number;
  recordCount: number;
  startedAt: string;
  persisted?: boolean;
}

interface GroundTruthRow {
  classId: string;
  difficulty: string;
  successCriterion: string;
}

const fmt = (value: number | null, digits = 0, suffix = "") =>
  value === null ? "—" : `${value.toFixed(digits)}${suffix}`;

const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

export default function BenchmarkPage() {
  const [selected, setSelected] = React.useState<Set<SystemId>>(
    () => new Set<SystemId>(["GRAVITY", "GRAVITY-STATIC"]),
  );
  const [runsPerClass, setRunsPerClass] = React.useState(1);
  const [manifest, setManifest] = React.useState<Manifest | null>(null);
  const [aggregates, setAggregates] = React.useState<Aggregate[]>([]);
  const [records, setRecords] = React.useState<RecordRow[]>([]);
  const [groundTruth, setGroundTruth] = React.useState<GroundTruthRow[]>([]);
  const [openrouterConfigured, setOpenrouterConfigured] = React.useState(false);
  const [deepseekConfigured, setDeepseekConfigured] = React.useState(false);
  const [phase, setPhase] = React.useState<"idle" | "running" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [showRecords, setShowRecords] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/benchmark");
      if (!res.ok) return;
      const data = await res.json();
      setManifest(data.manifest ?? null);
      setAggregates(data.aggregates ?? []);
      setRecords(data.records ?? []);
      setGroundTruth(data.groundTruth ?? []);
      setOpenrouterConfigured(Boolean(data.openrouterConfigured));
      setDeepseekConfigured(Boolean(data.deepseekConfigured));
    } catch {
      /* first-load race; the run will refresh */
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: SystemId) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBenchmark = React.useCallback(async () => {
    if (selected.size === 0 || phase === "running") return;
    setPhase("running");
    setError(null);
    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systems: [...selected],
          runsPerClass,
          seed: 42,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "benchmark run failed");
      setManifest({ ...data.manifest, persisted: data.persisted });
      setAggregates(data.aggregates ?? []);
      setRecords(data.records ?? []);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "benchmark run failed");
    } finally {
      if (phase !== "error") setPhase("idle");
    }
  }, [selected, runsPerClass, phase]);

  const systemOrder = SYSTEMS.map((s) => s.id);
  const classOrder = ["A", "B", "C", "D", "E"];
  const aggregateFor = (system: string, workloadClass: string) =>
    aggregates.find((a) => a.system === system && a.workloadClass === workloadClass) ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10">
      {/* ── Header ── */}
      <header className="space-y-3">
        <p className="meta">06 / Benchmark Harness</p>
        <h1 className="font-sans text-2xl font-light tracking-wide text-ivory">
          BACKEND BENCHMARK RUNNER
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-ivory-faint">
          The backend instruments itself: the same five workload tasks run through
          competing systems and every run emits a BenchmarkRecord — the common
          measurement language. GRAVITY-Static pins the kernel OFF, so the delta
          between the two GRAVITY rows IS the architecture&apos;s contribution.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="meta">
            openrouter {openrouterConfigured ? "· configured" : "· not set"}
          </span>
          <span className="meta">
            deepseek {deepseekConfigured ? "· configured" : "· not set"}
          </span>
        </div>
      </header>

      {/* ── System picker ── */}
      <section className="grid gap-3 sm:grid-cols-2">
        {SYSTEMS.map((system) => {
          const active = selected.has(system.id);
          return (
            <button
              key={system.id}
              type="button"
              onClick={() => toggle(system.id)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                active
                  ? "border-gold bg-gold-pale"
                  : "border-border bg-surface hover:border-border-subtle",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-sm font-medium", active ? "text-gold" : "text-ivory")}>
                  {system.label}
                </span>
                <span
                  className={cn(
                    "size-2 rounded-full",
                    active ? "bg-gold" : "bg-border-subtle",
                  )}
                />
              </div>
              <p className="meta mt-1.5">{system.note}</p>
            </button>
          );
        })}
      </section>

      {/* ── Run controls ── */}
      <section className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={runBenchmark}
          disabled={phase === "running" || selected.size === 0}
          className="studio-primary-button px-5 py-2 disabled:opacity-50"
        >
          {phase === "running" ? "RUNNING…" : `RUN ${selected.size} SYSTEM${selected.size === 1 ? "" : "S"} × 5 CLASSES`}
        </button>
        <label className="meta flex items-center gap-2">
          runs / class
          <select
            value={runsPerClass}
            onChange={(event) => setRunsPerClass(Number(event.target.value))}
            className="rounded border border-border bg-surface px-2 py-1 text-ivory"
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {manifest ? (
          <a
            href="/api/benchmark?format=csv"
            className="meta text-gold underline decoration-gold-dim underline-offset-4"
          >
            EXPORT CSV
          </a>
        ) : null}
      </section>

      {error ? (
        <p className="danger-text text-sm">Run failed: {error}</p>
      ) : null}

      {/* ── Manifest ── */}
      {manifest ? (
        <section className="meta flex flex-wrap gap-x-6 gap-y-1 text-ivory-faint">
          <span>run {manifest.runId}</span>
          <span>seed {manifest.seed}</span>
          <span>{manifest.recordCount} records</span>
          <span>runs/class {manifest.runsPerClass}</span>
          {manifest.persisted === true ? <span>· persisted to Firestore</span> : manifest.persisted === false ? <span>· in-memory (Firestore unavailable)</span> : null}
        </section>
      ) : null}

      {/* ── Investor table: systems × classes ── */}
      <section className="space-y-4">
        <p className="meta">SUCCESS RATE · p50 LATENCY · AVG TOKENS · LEVEL · COST</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="meta px-4 py-3 font-normal">SYSTEM</th>
                {classOrder.map((classId) => (
                  <th key={classId} className="meta px-4 py-3 font-normal">
                    CLASS {classId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {systemOrder.map((system) => (
                <tr key={system} className="border-b border-border-light last:border-0">
                  <td className="px-4 py-3 text-ivory">{system}</td>
                  {classOrder.map((classId) => {
                    const agg = aggregateFor(system, classId);
                    return (
                      <td key={classId} className="px-4 py-3 align-top text-ivory-faint">
                        {agg ? (
                          <div className="space-y-0.5">
                            <p className={cn("font-medium", agg.taskSuccessRate === 1 ? "success-text" : agg.taskSuccessRate === 0 ? "danger-text" : "text-warning-text")}>
                              {pct(agg.taskSuccessRate)} success
                            </p>
                            <p className="meta">
                              {fmt(agg.p50LatencyMs)}ms · {fmt(agg.avgTokensPerTask)} tok
                            </p>
                            <p className="meta">
                              {agg.avgIntelligenceLevel === null ? "—" : `L${agg.avgIntelligenceLevel.toFixed(1)}`} · ${fmt(agg.totalCost, 4)}
                            </p>
                          </div>
                        ) : (
                          <span className="meta">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Ground truth criteria ── */}
      <section className="space-y-3">
        <p className="meta">Deterministic success criteria — no LLM-vibes judging</p>
        <div className="grid gap-2">
          {groundTruth.map((truth) => (
            <div key={truth.classId} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-baseline gap-3">
                <span className="text-gold">{truth.classId}</span>
                <span className="meta">{truth.difficulty}</span>
              </div>
              <p className="mt-1 text-sm text-ivory-faint">{truth.successCriterion}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Raw records ── */}
      {records.length > 0 ? (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowRecords((v) => !v)}
            className="meta text-gold underline decoration-gold-dim underline-offset-4"
          >
            {showRecords ? "HIDE" : "SHOW"} RAW RECORDS ({records.length})
          </button>
          {showRecords ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    {["SYSTEM", "CLASS", "MODE", "SUCCESS", "VERIFY", "TOK (in/out)", "LATENCY", "LEVEL", "COST"].map((h) => (
                      <th key={h} className="meta px-3 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => (
                    <tr
                      key={`${record.benchmarkRunId}-${record.system}-${record.workloadClass}-${index}`}
                      className="border-b border-border-light last:border-0"
                    >
                      <td className="px-3 py-2 text-ivory">{record.system}</td>
                      <td className="px-3 py-2 text-gold">{record.workloadClass}</td>
                      <td className="meta px-3 py-2">{record.runMode}</td>
                      <td className={cn("px-3 py-2", record.success ? "success-text" : "danger-text")}>
                        {record.success ? "PASS" : "FAIL"}
                      </td>
                      <td className="meta px-3 py-2">{record.verificationStatus}</td>
                      <td className="meta px-3 py-2">
                        {record.inputTokens ?? "—"}/{record.outputTokens ?? "—"}
                      </td>
                      <td className="meta px-3 py-2">{fmt(record.latencyMs)}ms</td>
                      <td className="meta px-3 py-2">
                        {record.intelligenceLevel === null ? "—" : `L${record.intelligenceLevel}`}
                      </td>
                      <td className="meta px-3 py-2">${record.cost.totalCost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
