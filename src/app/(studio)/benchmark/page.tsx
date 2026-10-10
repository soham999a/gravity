"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SystemId = "GRAVITY" | "GRAVITY-STATIC" | "GRAVITY-OPENROUTER" | "JEV" | "CLAUDE" | "OPENAI";

const SYSTEMS: { id: SystemId; label: string; note: string; disabled?: boolean }[] = [
  { id: "GRAVITY", label: "GRAVITY", note: "adaptive kernel · full pipeline" },
  { id: "GRAVITY-STATIC", label: "GRAVITY-Static", note: "kernel pinned OFF · isolates the architecture" },
  { id: "GRAVITY-OPENROUTER", label: "GRAVITY-OpenRouter", note: "raw pinned OpenRouter model (paid $5 workhorse) · no kernel" },
  { id: "JEV", label: "Jev — NOT WIRED", note: "decision model · selecting it only records an honest UNSUPPORTED row", disabled: true },
  { id: "CLAUDE", label: "Claude", note: "claude-sonnet-5.5 · provider-pinned, raw" },
  { id: "OPENAI", label: "OpenAI", note: "gpt-oss-120b · provider-pinned, raw (needs credit)" },
];

const CLASSES = ["A", "B", "C", "D", "E"] as const;
type ClassId = (typeof CLASSES)[number];

interface Aggregate {
  system: string;
  workloadClass: string;
  runs: number;
  taskSuccessRate: number | null;
  p50LatencyMs: number | null;
  avgTokensPerTask: number | null;
  avgIntelligenceLevel: number | null;
  totalCost: number | null;
  avgQualityScore: number | null;
  verificationPassRate: number | null;
  costPerSuccessfulTask: number | null;
  decisionEfficiency: number | null;
  resourceEfficiency: number | null;
  escalationRate: number | null;
  avgModelCallsPerTask: number | null;
}

interface CostBreakdown {
  modelCost: number | null;
  computeCost: number | null;
  toolCost: number | null;
  verificationCost: number | null;
  orchestrationCost: number | null;
  totalCost: number | null;
}

interface RecordRow {
  system: string;
  workloadClass: string;
  runMode: string;
  model: string | null;
  provider: string | null;
  success: boolean;
  verificationStatus: string;
  qualityScore: number | null;
  difficulty: string;
  configHash: string;
  timestamp: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  ttftMs: number | null;
  intelligenceLevel: number | null;
  modelCalls: number;
  toolCalls: number;
  retries: number;
  escalations: number;
  cost: CostBreakdown;
  metadata: Record<string, unknown> | null;
  benchmarkRunId: string;
}

interface Manifest {
  runId: string;
  seed: number;
  taskVersion?: string;
  systems: string[];
  workloadClasses?: string[];
  runsPerClass: number;
  recordCount: number;
  startedAt: string;
  temperature?: number;
  maxTokens?: number;
  models?: Record<string, string | null>;
  persisted?: boolean;
}

interface SkippedSystem {
  system: string;
  reason: string;
}

interface PinnedConfig {
  claudeModel: string;
  openaiModel: string;
  openrouterModel: string;
  temperature: number;
  maxTokens: number;
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
  const [selectedClasses, setSelectedClasses] = React.useState<Set<ClassId>>(
    () => new Set<ClassId>(["A", "B", "C", "D", "E"]),
  );
  const [runsPerClass, setRunsPerClass] = React.useState(1);
  const [seed, setSeed] = React.useState(42);
  const [manifest, setManifest] = React.useState<Manifest | null>(null);
  const [aggregates, setAggregates] = React.useState<Aggregate[]>([]);
  const [records, setRecords] = React.useState<RecordRow[]>([]);
  const [groundTruth, setGroundTruth] = React.useState<GroundTruthRow[]>([]);
  const [reproducibility, setReproducibility] = React.useState<string | null>(null);
  const [taskSet, setTaskSet] = React.useState<string | null>(null);
  const [openrouterConfigured, setOpenrouterConfigured] = React.useState(false);
  const [deepseekConfigured, setDeepseekConfigured] = React.useState(false);
  const [pinnedConfig, setPinnedConfig] = React.useState<PinnedConfig | null>(null);
  const [jevWired, setJevWired] = React.useState(false);
  const [skippedSystems, setSkippedSystems] = React.useState<SkippedSystem[]>([]);
  const [phase, setPhase] = React.useState<"idle" | "running" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [showRecords, setShowRecords] = React.useState(false);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  // Run history A/B compare (store holds every run; page used to show latest only).
  const [runList, setRunList] = React.useState<Manifest[]>([]);
  const [compareId, setCompareId] = React.useState<string | null>(null);
  const [compareAggs, setCompareAggs] = React.useState<Aggregate[]>([]);
  const [compareMeta, setCompareMeta] = React.useState<Manifest | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/benchmark", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setManifest(data.manifest ?? null);
      setAggregates(data.aggregates ?? []);
      setRecords(data.records ?? []);
      setGroundTruth(data.groundTruth ?? []);
      setReproducibility(typeof data.reproducibility === "string" ? data.reproducibility : null);
      setTaskSet(typeof data.taskSet === "string" ? data.taskSet : null);
      setOpenrouterConfigured(Boolean(data.openrouterConfigured));
      setDeepseekConfigured(Boolean(data.deepseekConfigured));
      setPinnedConfig(data.pinnedConfig ?? null);
      setJevWired(Boolean(data.jevWired));
    } catch {
      /* first-load race; the run will refresh */
    }
    try {
      const rl = await fetch("/api/benchmark?runs=list", { credentials: "include" });
      if (rl.ok) {
        const list = await rl.json();
        setRunList(list.runs ?? []);
      }
    } catch {
      /* history optional — latest run still renders */
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: SystemId) => {
    if (SYSTEMS.find((s) => s.id === id)?.disabled) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleClass = (id: ClassId) =>
    setSelectedClasses((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const comboCount = selected.size * selectedClasses.size * runsPerClass;

  const selectAllRunnable = () =>
    setSelected(new Set(SYSTEMS.filter((s) => !s.disabled).map((s) => s.id)));

  const runBenchmark = React.useCallback(async () => {
    if (selected.size === 0 || selectedClasses.size === 0 || phase === "running") return;
    if (comboCount > 30) {
      setPhase("error");
      setError(
        `Too large: ${comboCount} combos (systems × classes × runs). Max 30 per run — deselect systems/classes or lower runs/class.`,
      );
      return;
    }
    setPhase("running");
    setError(null);
    setElapsedSec(0);
    // Client safety net: a run can never stick on RUNNING forever. If the
    // connection drops (server restart, sleep, blip) the request may never
    // settle — abort at 11 min and reload the latest persisted run, because
    // a finished run is saved server-side even if our response was lost.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 11 * 60_000);
    const tickId = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    try {
      const res = await fetch("/api/benchmark", { credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systems: [...selected],
          classes: [...selectedClasses],
          runsPerClass,
          seed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        throw new Error("Session expired — sign out and sign in again, then retry. Finished runs are safe in history.");
      }
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "benchmark run failed");
      setManifest({ ...data.manifest, persisted: data.persisted });
      setAggregates(data.aggregates ?? []);
      setRecords(data.records ?? []);
      setSkippedSystems(data.skippedSystems ?? []);
      setPhase("idle");
      // Refresh history so the just-finished run is comparable immediately.
      try {
        const rl = await fetch("/api/benchmark?runs=list", { credentials: "include" });
        if (rl.ok) setRunList((await rl.json()).runs ?? []);
      } catch {
        /* optional */
      }
    } catch (err) {
      // Refresh anyway: the run may have completed server-side while our
      // connection was lost — persisted results beat a stuck spinner.
      try {
        const latest = await fetch("/api/benchmark", { credentials: "include" });
        if (latest.ok) {
          const data = await latest.json();
          if (data.manifest && (data.records ?? []).length > 0) {
            setManifest(data.manifest ?? null);
            setAggregates(data.aggregates ?? []);
            setRecords(data.records ?? []);
          }
        }
      } catch {
        /* offline — keep the honest error below */
      }
      setPhase("error");
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "Run timed out on our screen after 11 min — it may still have finished server-side (results above, if any). Refresh to check; don't spam RUN (5/hour limit)."
          : err instanceof Error ? err.message : "benchmark run failed",
      );
    } finally {
      clearTimeout(timeoutId);
      clearInterval(tickId);
    }
  }, [selected, selectedClasses, runsPerClass, seed, phase, comboCount, load]);

  const systemOrder = SYSTEMS.map((s) => s.id);
  const classOrder = ["A", "B", "C", "D", "E"];
  const aggregateFor = (system: string, workloadClass: string) =>
    aggregates.find((a) => a.system === system && a.workloadClass === workloadClass) ?? null;
  // First measured record per cell — feeds the model + config-hash tooltip
  // (proves "same model?" without a server change; records carry both).
  const recordFor = (system: string, workloadClass: string) =>
    records.find((r) => r.system === system && r.workloadClass === workloadClass) ?? null;
  const shortHash = (h: string) => (h.startsWith("sha256:") ? `sha256:${h.slice(7, 15)}…` : h.slice(0, 14) || "—");
  const shortModel = (m: string | null) =>
    !m ? "n/a" : m.includes("/") ? (m.split("/").pop() ?? m) : m;

  // ── Real points: deterministic composite of MEASURED rates only ──
  // cell points = 100 × (0.7 × successRate + 0.3 × verificationPassRate),
  // falling back to whichever rate is measured. Null (rendered "—") only
  // when the cell measured nothing — never a fabricated number.
  const cellPoints = (a: Aggregate): number | null => {
    const sr = a.taskSuccessRate;
    const vpr = a.verificationPassRate ?? null;
    if (sr === null && vpr === null) return null;
    const s = sr ?? vpr!;
    const v = vpr ?? sr!;
    return Math.round(100 * (0.7 * s + 0.3 * v));
  };
  const pts = (value: number | null) => (value === null ? "—" : `${value} pts`);

  // Visual comparison: per-system means across classes (nulls excluded).
  const systemSummary = systemOrder
    .map((system) => {
      const rows = classOrder
        .map((c) => aggregateFor(system, c))
        .filter((a) => a !== null);
      if (rows.length === 0) return null;
      const mean = (pick: (a: Aggregate) => number | null) => {
        const vals = rows.map(pick).filter((v): v is number => v !== null);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      const pointVals = rows.map(cellPoints).filter((v): v is number => v !== null);
      return {
        system,
        success: mean((a) => a.taskSuccessRate),
        tokens: mean((a) => a.avgTokensPerTask),
        latency: mean((a) => a.p50LatencyMs),
        quality: mean((a) => a.avgQualityScore),
        points: pointVals.length > 0 ? pointVals.reduce((a, b) => a + b, 0) / pointVals.length : null,
      };
    })
    .filter((s) => s !== null);
  const maxTokens = Math.max(1, ...systemSummary.map((s) => s.tokens ?? 0));
  const maxLatency = Math.max(1, ...systemSummary.map((s) => s.latency ?? 0));

  // Leaderboard: rank systems by real points (tiebreak: success, then quality).
  const leaderboard = [...systemSummary].sort((a, b) => {
    const dp = (b.points ?? -1) - (a.points ?? -1);
    if (dp !== 0) return dp;
    const ds = (b.success ?? -1) - (a.success ?? -1);
    if (ds !== 0) return ds;
    return (b.quality ?? -1) - (a.quality ?? -1);
  });
  const maxPoints = Math.max(1, ...leaderboard.map((s) => s.points ?? 0));

  // History compare: mean cell-points per system for any aggregate set.
  const pointsBySystem = (aggs: Aggregate[]): Map<string, number | null> => {
    const out = new Map<string, number | null>();
    for (const system of systemOrder) {
      const cells = classOrder
        .map((c) => aggs.find((a) => a.system === system && a.workloadClass === c) ?? null)
        .filter((a) => a !== null)
        .map((a) => cellPoints(a!))
        .filter((v): v is number => v !== null);
      out.set(system, cells.length > 0 ? cells.reduce((x, y) => x + y, 0) / cells.length : null);
    }
    return out;
  };
  const runLabel = (m: Manifest) =>
    `${m.runId.slice(0, 14)} · ${new Date(m.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${m.systems.length}sys × ${m.runsPerClass}/class`;

  const loadCompare = React.useCallback(async (runId: string) => {
    setCompareId(runId);
    if (!runId) {
      setCompareAggs([]);
      setCompareMeta(null);
      return;
    }
    try {
      const res = await fetch(`/api/benchmark?runId=${encodeURIComponent(runId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("run not found");
      const data = await res.json();
      setCompareAggs(data.aggregates ?? []);
      setCompareMeta(data.manifest ?? null);
    } catch {
      setCompareAggs([]);
      setCompareMeta(null);
    }
  }, []);

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
          {pinnedConfig ? (
            <span className="meta">
              pinned {pinnedConfig.claudeModel} · {pinnedConfig.openaiModel} · temp {pinnedConfig.temperature} · {pinnedConfig.maxTokens} tok
            </span>
          ) : null}
        </div>
      </header>

      {/* ── System picker ── */}
      <section className="grid gap-3 sm:grid-cols-2">
        {SYSTEMS.map((system) => {
          const active = selected.has(system.id);
          const disabled = Boolean(system.disabled);
          return (
            <button
              key={system.id}
              type="button"
              onClick={() => toggle(system.id)}
              disabled={disabled}
              title={disabled ? "Not wired yet — records UNSUPPORTED, excluded from runs" : system.note}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                disabled
                  ? "cursor-not-allowed border-border bg-surface opacity-50"
                  : active
                    ? "border-gold bg-gold-pale"
                    : "border-border bg-surface hover:border-border-subtle",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-sm font-medium", active && !disabled ? "text-gold" : "text-ivory")}>
                  {system.label}
                </span>
                <span
                  className={cn(
                    "size-2 rounded-full",
                    active && !disabled ? "bg-gold" : "bg-border-subtle",
                  )}
                />
              </div>
              <p className="meta mt-1.5">{system.note}</p>
            </button>
          );
        })}
      </section>

      {/* ── Class picker ── */}
      <section className="flex flex-wrap items-center gap-2">
        <span className="meta mr-1">CLASSES</span>
        {CLASSES.map((classId) => {
          const active = selectedClasses.has(classId);
          return (
            <button
              key={classId}
              type="button"
              onClick={() => toggleClass(classId)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-gold bg-gold-pale text-gold"
                  : "border-border bg-surface text-ivory-faint hover:border-border-subtle",
              )}
            >
              {classId}
            </button>
          );
        })}
        <span className="meta ml-2">
          {comboCount} combos{comboCount > 30 ? " · TOO LARGE (max 30)" : comboCount > 12 ? " · may near the 120s limit" : ""}
        </span>
      </section>

      {/* ── Run controls ── */}
      <section className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={runBenchmark}
          disabled={phase === "running" || selected.size === 0 || selectedClasses.size === 0}
          className="studio-primary-button px-5 py-2 disabled:opacity-50"
        >
          {phase === "running" ? `RUNNING… ${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")} · ${comboCount} combos, don't close` : `RUN ${selected.size} SYSTEM${selected.size === 1 ? "" : "S"} × ${selectedClasses.size} CLASS${selectedClasses.size === 1 ? "" : "ES"}`}
        </button>
        <button
          type="button"
          onClick={selectAllRunnable}
          className="meta text-gold underline decoration-gold-dim underline-offset-4"
        >
          SELECT ALL RUNNABLE
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
        <label className="meta flex items-center gap-2">
          seed
          <input
            type="number"
            value={seed}
            onChange={(event) => setSeed(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
            className="w-20 rounded border border-border bg-surface px-2 py-1 text-ivory"
          />
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

      {skippedSystems.length > 0 ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="meta text-warning-text">HONESTLY SKIPPED (adapter recorded, not fabricated)</p>
          {skippedSystems.map((skip) => (
            <p key={skip.system} className="mt-1 text-sm text-ivory-faint">
              <span className="text-gold">{skip.system}</span> — {skip.reason}
            </p>
          ))}
        </section>
        ) : null}

      {/* ── Manifest + frozen config (onboarding: freeze everything, hash it) ── */}
      {manifest ? (
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="meta flex flex-wrap gap-x-6 gap-y-1 text-ivory-faint">
            <span>run {manifest.runId}</span>
            <span>seed {manifest.seed}</span>
            {manifest.taskVersion ? <span>tasks {manifest.taskVersion}</span> : taskSet ? <span>tasks {taskSet}</span> : null}
            <span>{manifest.recordCount} records</span>
            <span>runs/class {manifest.runsPerClass}</span>
            {manifest.temperature !== undefined ? <span>temp {manifest.temperature}</span> : null}
            {manifest.maxTokens !== undefined ? <span>max {manifest.maxTokens} tok</span> : null}
            {manifest.persisted === true ? <span>· persisted to Firestore</span> : manifest.persisted === false ? <span>· in-memory (Firestore unavailable)</span> : null}
          </div>
          {manifest.models ? (
            <div className="meta flex flex-wrap gap-x-6 gap-y-1 text-ivory-faint">
              {Object.entries(manifest.models).map(([system, model]) => (
                <span key={system}>
                  {system}: {model ?? "n/a (not wired)"}
                </span>
              ))}
            </div>
          ) : null}
          {reproducibility ? (
            <p className="text-xs leading-relaxed text-ivory-faint">
              <span className="meta text-gold">REPRODUCIBILITY — </span>
              {reproducibility}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ── Leaderboard: real points, ranked ── */}
      {leaderboard.length > 0 ? (
        <section className="space-y-4">
          <p className="meta">LEADERBOARD · REAL POINTS (100 × 0.7 SUCCESS + 0.3 VERIFY, PER CLASS MEAN)</p>
          <div className="grid gap-2">
            {leaderboard.map((s, rank) => (
              <div key={s.system} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-ivory">
                    <span className="meta mr-2 text-gold">#{rank + 1}</span>
                    {s.system}
                  </span>
                  <span className="meta">
                    {s.points === null ? "— pts" : `${Math.round(s.points)} pts`}
                    {s.success === null ? " · — success" : ` · ${Math.round(s.success * 100)}% success`}
                    {s.quality !== null ? ` · Q ${s.quality.toFixed(2)}` : ""}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="meta w-16 shrink-0">POINTS</span>
                  <div className="h-2 flex-1 rounded bg-border-light">
                    <div
                      className="h-2 rounded bg-gold"
                      style={{ width: `${Math.max(2, Math.round(((s.points ?? 0) / maxPoints) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Run history compare: current vs any past run ── */}
      {runList.length > 1 ? (
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <p className="meta">RUN HISTORY COMPARE · CURRENT ({manifest?.runId.slice(0, 14) ?? "—"}) VS PAST</p>
          <label className="meta flex items-center gap-2">
            PAST RUN
            <select
              value={compareId ?? ""}
              onChange={(e) => loadCompare(e.target.value)}
              className="max-w-full rounded border border-border bg-surface px-2 py-1 text-ivory"
            >
              <option value="">pick a past run…</option>
              {runList
                .filter((r) => r.runId !== manifest?.runId)
                .map((r) => (
                  <option key={r.runId} value={r.runId}>
                    {runLabel(r)}
                  </option>
                ))}
            </select>
          </label>
          {compareId && compareMeta ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="meta px-3 py-2 font-normal">SYSTEM</th>
                    <th className="meta px-3 py-2 font-normal">NOW</th>
                    <th className="meta px-3 py-2 font-normal">THEN</th>
                    <th className="meta px-3 py-2 font-normal">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const now = pointsBySystem(aggregates);
                    const then = pointsBySystem(compareAggs);
                    return systemOrder
                      .filter((s) => now.get(s) !== null || then.get(s) !== null)
                      .map((s) => {
                        const a = now.get(s) ?? null;
                        const b = then.get(s) ?? null;
                        const d = a !== null && b !== null ? Math.round(a - b) : null;
                        return (
                          <tr key={s} className="border-b border-border-light last:border-0">
                            <td className="px-3 py-2 text-ivory">{s}</td>
                            <td className="px-3 py-2 text-ivory-faint">{a === null ? "—" : `${Math.round(a)} pts`}</td>
                            <td className="px-3 py-2 text-ivory-faint">{b === null ? "—" : `${Math.round(b)} pts`}</td>
                            <td className={cn("px-3 py-2 font-medium", d === null ? "text-ivory-faint" : d > 0 ? "success-text" : d < 0 ? "danger-text" : "text-warning-text")}>
                              {d === null ? "—" : `${d > 0 ? "+" : ""}${d}`}
                            </td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── Visual comparison: systems at a glance ── */}
      {systemSummary.length > 0 ? (
        <section className="space-y-4">
          <p className="meta">VISUAL COMPARISON · MEAN ACROSS CLASSES</p>
          <div className="grid gap-2">
            {systemSummary.map((s) => (
              <div key={s.system} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-ivory">{s.system}</span>
                  <span className="meta">
                    {s.points === null ? "— pts" : `${Math.round(s.points)} pts`}
                    {s.success === null ? " · — success" : ` · ${Math.round(s.success * 100)}% success`}
                    {s.quality !== null ? ` · Q ${s.quality.toFixed(2)}` : ""}
                    {s.tokens !== null ? ` · ${fmt(s.tokens)} tok/task` : ""}
                    {s.latency !== null ? ` · p50 ${fmt(s.latency)}ms` : ""}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="meta w-16 shrink-0">POINTS</span>
                    <div className="h-2 flex-1 rounded bg-border-light">
                      <div
                        className="h-2 rounded bg-gold"
                        style={{ width: `${Math.max(2, Math.round(((s.points ?? 0) / maxPoints) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="meta w-16 shrink-0">SUCCESS</span>
                    <div className="h-2 flex-1 rounded bg-border-light">
                      <div
                        className="h-2 rounded bg-gold"
                        style={{ width: `${Math.round((s.success ?? 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="meta w-16 shrink-0">TOKENS</span>
                    <div className="h-2 flex-1 rounded bg-border-light">
                      <div
                        className="h-2 rounded bg-ivory-faint"
                        style={{ width: `${Math.max(2, Math.round(((s.tokens ?? 0) / maxTokens) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="meta w-16 shrink-0">LATENCY</span>
                    <div className="h-2 flex-1 rounded bg-border-light">
                      <div
                        className="h-2 rounded bg-ivory-faint"
                        style={{ width: `${Math.max(2, Math.round(((s.latency ?? 0) / maxLatency) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Investor table: systems × classes ── */}
      <section className="space-y-4">
        <p className="meta">POINTS · SUCCESS RATE · p50 LATENCY · AVG TOKENS · QUALITY · COST</p>
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
                    const rec = recordFor(system, classId);
                    const tip = rec
                      ? `model: ${rec.model ?? "n/a"} · provider: ${rec.provider ?? "n/a"} · config: ${rec.configHash || "—"} · difficulty: ${rec.difficulty} · ${rec.timestamp}`
                      : "no measured record yet";
                    return (
                      <td key={classId} className="px-4 py-3 align-top text-ivory-faint" title={tip}>
                        {agg ? (
                          <div className="space-y-0.5">
                            <p className={cn("font-medium", (cellPoints(agg) ?? 0) >= 70 ? "success-text" : (cellPoints(agg) ?? 0) >= 40 ? "text-warning-text" : "danger-text")}>
                              {pts(cellPoints(agg))}
                            </p>
                            <p className={cn("font-medium", agg.taskSuccessRate === 1 ? "success-text" : agg.taskSuccessRate === 0 ? "danger-text" : "text-warning-text")}>
                              {pct(agg.taskSuccessRate)} success
                            </p>
                            <p className="meta">
                              {fmt(agg.p50LatencyMs)}ms · {fmt(agg.avgTokensPerTask)} tok
                            </p>
                            <p className="meta">
                              Q {agg.avgQualityScore === null ? "—" : agg.avgQualityScore.toFixed(2)} · {agg.avgIntelligenceLevel === null ? "—" : `L${agg.avgIntelligenceLevel.toFixed(1)}`} · ${fmt(agg.totalCost, 4)}
                            </p>
                            <p className="meta opacity-80">
                              {shortModel(rec?.model ?? null)} · {shortHash(rec?.configHash ?? "")}
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

      {/* ── Efficiency: decision · resource · escalation · verify (spec §Efficiency) ── */}
      <section className="space-y-4">
        <p className="meta">EFFICIENCY · DECISION · RESOURCE · ESCALATION RATE · VERIFY RATE · COST/SUCCESS</p>
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
                    const ratio = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
                    return (
                      <td key={classId} className="px-4 py-3 align-top text-ivory-faint">
                        {agg ? (
                          <div className="space-y-0.5">
                            <p className="meta">DEC {ratio(agg.decisionEfficiency)} · RES {ratio(agg.resourceEfficiency)}</p>
                            <p className="meta">ESC {ratio(agg.escalationRate)} · VER {ratio(agg.verificationPassRate)}</p>
                            <p className="meta">
                              {agg.costPerSuccessfulTask === null ? "—" : `$${agg.costPerSuccessfulTask.toFixed(4)}`} / success
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
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    {["SYSTEM", "CLASS", "MODE", "SUCCESS", "VERIFY", "QUALITY", "TOK (in/out)", "LATENCY", "LEVEL", "COST"].map((h) => (
                      <th key={h} className="meta px-3 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => {
                    const key = `${record.benchmarkRunId}-${record.system}-${record.workloadClass}-${index}`;
                    const open = expanded === key;
                    const meta = (record.metadata ?? {}) as Record<string, unknown>;
                    const evidence = (meta.evidence ?? null) as Record<string, unknown> | null;
                    const rawText = typeof meta.raw_text === "string" ? meta.raw_text : "";
                    const errText = typeof meta.error === "string" ? meta.error : "";
                    return (
                      <React.Fragment key={key}>
                        <tr
                          onClick={() => setExpanded(open ? null : key)}
                          title={open ? "Collapse evidence" : "Click for evidence — what exactly passed/failed"}
                          className={cn(
                            "cursor-pointer border-b border-border-light last:border-0 hover:bg-gold-pale",
                            open && "bg-gold-pale",
                          )}
                        >
                          <td className="px-3 py-2 text-ivory">{record.system}</td>
                          <td className="px-3 py-2 text-gold">{record.workloadClass}</td>
                          <td className="meta px-3 py-2">{record.runMode}</td>
                          <td className={cn("px-3 py-2", record.success ? "success-text" : "danger-text")}>
                            {record.success ? "PASS" : "FAIL"}
                          </td>
                          <td className="meta px-3 py-2">{record.verificationStatus}</td>
                          <td className="meta px-3 py-2">
                            {record.qualityScore === null || record.qualityScore === undefined ? "—" : record.qualityScore.toFixed(2)}
                          </td>
                          <td className="meta px-3 py-2">
                            {record.inputTokens ?? "—"}/{record.outputTokens ?? "—"}
                          </td>
                          <td className="meta px-3 py-2">{fmt(record.latencyMs)}ms</td>
                          <td className="meta px-3 py-2">
                            {record.intelligenceLevel === null ? "—" : `L${record.intelligenceLevel}`}
                          </td>
                          <td className="meta px-3 py-2">
                            {record.cost.totalCost === null ? "—" : `$${record.cost.totalCost.toFixed(4)}`}
                          </td>
                        </tr>
                        {open ? (
                          <tr key={`${key}-detail`} className="border-b border-border-light">
                            <td colSpan={10} className="bg-surface px-4 py-3">
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <p className="meta text-gold">EVIDENCE — WHAT WAS CHECKED</p>
                                  {evidence ? (
                                    <div className="mt-1 space-y-0.5">
                                      {Object.entries(evidence).map(([k, v]) => (
                                        <p key={k} className="meta break-all">
                                          {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                        </p>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="meta mt-1">— no evidence captured</p>
                                  )}
                                  {errText ? (
                                    <p className="meta mt-2 break-all text-danger-text">error: {errText.slice(0, 300)}</p>
                                  ) : null}
                                </div>
                                <div>
                                  <p className="meta text-gold">TRACE + COST</p>
                                  <p className="meta mt-1 break-all">
                                    model {record.model ?? "n/a"} · {record.provider ?? "n/a"}
                                  </p>
                                  <p className="meta break-all">config {record.configHash || "—"}</p>
                                  <p className="meta">
                                    calls {record.modelCalls}m/{record.toolCalls}t · retries {record.retries} · esc {record.escalations} · ttft {record.ttftMs ?? "—"}ms · {record.timestamp}
                                  </p>
                                  <p className="meta">
                                    cost m {record.cost.modelCost ?? "—"} · c {record.cost.computeCost ?? "—"} · t {record.cost.toolCost ?? "—"} · v {record.cost.verificationCost ?? "—"} · o {record.cost.orchestrationCost ?? "—"}
                                  </p>
                                  {rawText ? (
                                    <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ivory-faint">
                                      {rawText.slice(0, 900)}{rawText.length > 900 ? "…" : ""}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
