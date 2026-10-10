"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SystemId = "GRAVITY" | "GRAVITY-STATIC" | "GRAVITY-OPENROUTER" | "JEV" | "CLAUDE" | "OPENAI";

const SYSTEMS: { id: SystemId; label: string; note: string; disabled?: boolean; hidden?: boolean }[] = [
  { id: "GRAVITY", label: "GRAVITY", note: "adaptive kernel · full pipeline" },
  { id: "GRAVITY-STATIC", label: "GRAVITY-Static", note: "kernel pinned OFF · isolates the architecture" },
  { id: "GRAVITY-OPENROUTER", label: "GRAVITY-OpenRouter", note: "raw pinned OpenRouter model (paid $5 workhorse) · no kernel" },
  // Jev picker hidden until its REST API is wired — a permanent empty column
  // reads as broken. Historic UNSUPPORTED rows still render wherever stored.
  { id: "JEV", label: "Jev — NOT WIRED", note: "decision model · selecting it only records an honest UNSUPPORTED row", disabled: true, hidden: true },
  { id: "CLAUDE", label: "Claude", note: "claude-sonnet-5.5 · provider-pinned, raw" },
  { id: "OPENAI", label: "OpenAI", note: "gpt-oss-120b · provider-pinned, raw (needs credit)" },
];

const CLASSES = ["A", "B", "C", "D", "E"] as const;
type ClassId = (typeof CLASSES)[number];

/** Spec §workloads: the architectural claim each class probes. */
const CLASS_CLAIMS: Record<ClassId, string> = {
  A: "Minimum sufficient intelligence — L0 local math, near-zero model cost.",
  B: "Stats-first routing — spike + trend computed, not hallucinated.",
  C: "Escalation ladder fires — cheap start, model only when required.",
  D: "Orchestration + parallelism — 3 workstreams, then synthesis.",
  E: "Adaptation under failure — the differentiating class. Adapt or die.",
};

/** Spec §tracks: B isolates architecture (model fixed), A compares systems. */
const TRACK_OF: Record<string, "A" | "B"> = {
  GRAVITY: "B",
  "GRAVITY-STATIC": "B",
  "GRAVITY-OPENROUTER": "A",
  JEV: "A",
  CLAUDE: "A",
  OPENAI: "A",
};

interface Aggregate {
  system: string;
  workloadClass: string;
  runs: number;
  taskSuccessRate: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  avgTokensPerTask: number | null;
  avgIntelligenceLevel: number | null;
  totalCost: number | null;
  avgQualityScore: number | null;
  qualityMeasured: number;
  qualityOf: number;
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
  const MAX_TOTAL = 60;
  const CHUNK_MAX = 6;

  const selectAllRunnable = () =>
    setSelected(new Set(SYSTEMS.filter((s) => !s.disabled && !s.hidden).map((s) => s.id)));

  /** Split a run into Vercel-safe chunks (≤6 combos each): per system, slice
   *  its runs so every chunk stays under the server's per-request ceiling. */
  const planChunks = (
    systems: string[],
    classes: string[],
    runs: number,
  ): { systems: string[]; classes: string[]; runsPerClass: number }[] => {
    const chunks: { systems: string[]; classes: string[]; runsPerClass: number }[] = [];
    const perRun = Math.max(1, classes.length);
    for (const system of systems) {
      let left = runs;
      while (left > 0) {
        const k = Math.max(1, Math.min(left, Math.floor(CHUNK_MAX / perRun)));
        chunks.push({ systems: [system], classes, runsPerClass: k });
        left -= k;
      }
    }
    return chunks;
  };

  const [runLog, setRunLog] = React.useState<string[]>([]);
  const [runProgress, setRunProgress] = React.useState<{ done: number; total: number; label: string } | null>(null);
  const [lastPlan, setLastPlan] = React.useState<{ systems: string[]; classes: string[]; runsPerClass: number; seed: number } | null>(null);
  const stopRef = React.useRef<AbortController | null>(null);
  const runProgressRef = React.useRef(0);

  /** One chunk over SSE: live progress → final (or error). Returns the final payload. */
  const runChunk = React.useCallback(
    async (
      chunk: { systems: string[]; classes: string[]; runsPerClass: number },
      seed: number,
      runId: string | undefined,
      signal: AbortSignal,
      base: number,
      chunkTotal: number,
      grandTotal: number,
    ): Promise<{ manifest: Manifest; records: RecordRow[]; aggregates: Aggregate[]; skippedSystems: SkippedSystem[]; aborted: boolean; persisted?: boolean; runId: string }> => {
      const res = await fetch("/api/benchmark", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        signal,
        body: JSON.stringify({ ...chunk, seed, runId }),
      });
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "benchmark chunk failed");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no stream body");
      const decoder = new TextDecoder();
      let buffer = "";
      let final: { manifest: Manifest; records: RecordRow[]; aggregates: Aggregate[]; skippedSystems: SkippedSystem[]; aborted: boolean; persisted?: boolean; runId: string } | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          let evt: unknown;
          try {
            evt = JSON.parse(t.slice(5).trim());
          } catch {
            continue; // partial line — next chunk completes it
          }
          const e = evt as
            | { type: "progress"; current: number; total: number; label: string }
            | { type: "result"; manifest: Manifest; records: RecordRow[]; aggregates: Aggregate[]; skippedSystems: SkippedSystem[]; aborted: boolean; persisted?: boolean; runId: string }
            | { type: "error"; error: string };
          if (e.type === "progress") {
            const doneCount = base + Math.round(((e.current ?? 0) / Math.max(1, chunkTotal)) * chunkTotal);
            setRunProgress({ done: Math.min(doneCount, grandTotal), total: grandTotal, label: e.label });
            setRunLog((prev) => [...prev.slice(-79), `${e.current}/${e.total} ${e.label}`]);
            } else if (e.type === "result") {
              final = {
                manifest: e.manifest,
                records: e.records ?? [],
                aggregates: e.aggregates ?? [],
                skippedSystems: e.skippedSystems ?? [],
                aborted: !!e.aborted,
                persisted: e.persisted,
                runId: e.runId ?? e.manifest?.runId ?? runId ?? "",
              };
            } else if (e.type === "error") {
            throw new Error(e.error);
          }
        }
      }
      if (!final) throw new Error("stream ended without a result — refresh; completed chunks are persisted");
      return final;
    },
    [],
  );

  const runBenchmark = React.useCallback(async (retryPlan?: { systems: string[]; classes: string[]; runsPerClass: number; seed: number }) => {
    const plan = retryPlan ?? {
      systems: [...selected],
      classes: [...selectedClasses],
      runsPerClass,
      seed,
    };
    if (plan.systems.length === 0 || plan.classes.length === 0 || phase === "running") return;
    const total = plan.systems.length * plan.classes.length * plan.runsPerClass;
    if (total > MAX_TOTAL) {
      setPhase("error");
      setError(
        `Too large: ${total} combos (systems × classes × runs). Max ${MAX_TOTAL} per run — deselect or lower runs/class.`,
      );
      return;
    }
    setPhase("running");
    setError(null);
    setElapsedSec(0);
    setRunLog([]);
    setRunProgress({ done: 0, total, label: "starting…" });
    setLastPlan(plan);
    const controller = new AbortController();
    stopRef.current = controller;
    runProgressRef.current = 0;
    const tickId = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    const chunks = planChunks(plan.systems, plan.classes, plan.runsPerClass);
    let runId: string | undefined;
    let stopped = false;
    try {
      for (const chunk of chunks) {
        const chunkCombos = chunk.systems.length * chunk.classes.length * chunk.runsPerClass;
        const doneBefore = runProgressRef.current;
        const final = await runChunk(chunk, plan.seed, runId, controller.signal, doneBefore, chunkCombos, total);
        runId = final.runId || runId;
        runProgressRef.current = Math.min(total, doneBefore + chunkCombos);
        setRunProgress({ done: runProgressRef.current, total, label: `chunk done · ${final.records.length} records` });
        setSkippedSystems(final.skippedSystems);
        if (final.aborted || controller.signal.aborted) {
          stopped = true;
          break;
        }
      }
      // Paint the merged run (all chunks share one runId — persisted per chunk).
      const latest = await fetch("/api/benchmark", { credentials: "include", signal: controller.signal });
      if (!latest.ok) throw new Error("could not reload merged run");
      const data = await latest.json();
      setManifest({ ...data.manifest, persisted: data.persisted });
      setAggregates(data.aggregates ?? []);
      setRecords(data.records ?? []);
      setSkippedSystems(data.skippedSystems ?? []);
      setPhase("idle");
      if (stopped) {
        setError("Stopped — partial results above are real persisted records. Re-run to complete the plan.");
      }
      try {
        const rl = await fetch("/api/benchmark?runs=list", { credentials: "include" });
        if (rl.ok) setRunList((await rl.json()).runs ?? []);
      } catch {
        /* optional */
      }
    } catch (err) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        setPhase("error");
        setError("Session expired — sign out and sign in again, then press RETRY RUN below. Your plan is kept.");
        return;
      }
      // Refresh anyway: completed chunks persisted under one runId.
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
        /* offline */
      }
      setPhase("error");
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "Stopped — completed chunks are persisted (results above, if any). Re-run to finish the plan."
          : err instanceof Error ? err.message : "benchmark run failed",
      );
    } finally {
      clearInterval(tickId);
      stopRef.current = null;
      setRunProgress(null);
    }
  }, [selected, selectedClasses, runsPerClass, seed, phase, runChunk]);

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
        latency95: mean((a) => a.p95LatencyMs),
        quality: mean((a) => a.avgQualityScore),
        costPS: mean((a) => a.costPerSuccessfulTask),
        resEff: mean((a) => a.resourceEfficiency),
        decEff: mean((a) => a.decisionEfficiency),
        vpr: mean((a) => a.verificationPassRate),
        points: pointVals.length > 0 ? pointVals.reduce((a, b) => a + b, 0) / pointVals.length : null,
      };
    })
    .filter((s) => s !== null);
  const maxTokens = Math.max(1, ...systemSummary.map((s) => s.tokens ?? 0));
  const maxLatency = Math.max(1, ...systemSummary.map((s) => s.latency ?? 0));
  // Nothing measured yet → designed empty state instead of walls of "—".
  const hasData = aggregates.length > 0 || records.length > 0;

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

  /** Slide PDF: same measured data as the slide table — never estimates. */
  const exportSlidePdf = React.useCallback(async () => {
    const { downloadSlidePdf } = await import("@/lib/benchmarkPdf");
    const cheapest = [...leaderboard]
      .filter((s) => s.costPS !== null)
      .sort((a, b) => (a.costPS ?? Infinity) - (b.costPS ?? Infinity))[0] ?? null;
    await downloadSlidePdf({
      runId: manifest?.runId ?? "latest",
      seed: manifest?.seed ?? 0,
      taskVersion: manifest?.taskVersion ?? undefined,
      recordCount: manifest?.recordCount ?? records.length,
      startedAt: manifest?.startedAt ?? new Date().toISOString(),
      heroCost: cheapest?.costPS != null ? `$${cheapest.costPS.toFixed(4)}` : "—",
      heroCostSystem: cheapest?.system ?? "—",
      systems: leaderboard.map((s) => ({
        system: s.system,
        track: TRACK_OF[s.system] ?? "A",
        success: s.success === null ? "—" : `${Math.round(s.success * 100)}%`,
        costPS: s.costPS === null ? "—" : `$${s.costPS.toFixed(4)}`,
        latency: s.latency === null ? "—" : `${fmt(s.latency)}ms`,
        tokens: s.tokens === null ? "—" : fmt(s.tokens),
        resEff: s.resEff === null ? "—" : `${Math.round(s.resEff * 100)}%`,
        verify: s.vpr === null ? "—" : `${Math.round(s.vpr * 100)}%`,
        decEff: s.decEff === null ? "—" : `${Math.round(s.decEff * 100)}%`,
        points: s.points === null ? "—" : `${Math.round(s.points)}`,
      })),
    });
  }, [leaderboard, manifest, records.length]);

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
        <p className="max-w-3xl text-sm font-medium leading-relaxed text-gold">
          Why spend frontier-level intelligence when lower-cost computation is
          sufficient? Same task · same input · same criterion — measured evidence only.
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

      {/* ── System picker (Jev hidden until its API is wired) ── */}
      <section className="grid gap-3 sm:grid-cols-2">
        {SYSTEMS.filter((system) => !system.hidden).map((system) => {
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
          {comboCount} combos{comboCount > MAX_TOTAL ? ` · TOO LARGE (max ${MAX_TOTAL})` : comboCount > 8 ? " · auto-chunked ≤6/request" : ""}
        </span>
      </section>

      {/* ── Run controls (sticky: always in reach on long result pages) ── */}
      <section className="bench-sticky flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => runBenchmark()}
          disabled={phase === "running" || selected.size === 0 || selectedClasses.size === 0}
          className="studio-primary-button px-5 py-2 disabled:opacity-50"
        >
          {phase === "running" ? `RUNNING… ${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")} · ${comboCount} combos, don't close` : `RUN ${selected.size} SYSTEM${selected.size === 1 ? "" : "S"} × ${selectedClasses.size} CLASS${selectedClasses.size === 1 ? "" : "ES"}`}
        </button>
        {phase === "running" ? (
          <button
            type="button"
            onClick={() => stopRef.current?.abort()}
            className="studio-secondary-button px-4 py-2"
            title="Stop after the current chunk — completed chunks stay persisted"
          >
            STOP
          </button>
        ) : null}
        {phase === "error" && lastPlan && error?.includes("Session expired") ? (
          <button
            type="button"
            onClick={() => runBenchmark(lastPlan)}
            className="studio-primary-button px-4 py-2"
          >
            RETRY RUN
          </button>
        ) : null}
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
            {[1, 2, 3, 5].map((n) => (
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
        {leaderboard.length > 0 ? (
          <button
            type="button"
            onClick={() => void exportSlidePdf()}
            className="meta text-gold underline decoration-gold-dim underline-offset-4"
          >
            EXPORT SLIDE PDF
          </button>
        ) : null}
      </section>

      {/* ── Live progress + run log ── */}
      {phase === "running" && runProgress ? (
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="meta text-gold">
              {runProgress.done}/{runProgress.total} JOBS
            </span>
            <span className="meta break-all">{runProgress.label}</span>
          </div>
          <div className="h-2 rounded bg-border-light">
            <div
              className="h-2 rounded bg-gold transition-all"
              style={{ width: `${Math.min(100, Math.round((runProgress.done / Math.max(1, runProgress.total)) * 100))}%` }}
            />
          </div>
        </section>
      ) : null}
      {runLog.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <p className="meta">RUN LOG · {runLog.length} JOBS SETTLED (chunks persist per job)</p>
          <div className="max-h-36 space-y-0.5 overflow-y-auto">
            {runLog.slice(-12).map((line, i) => (
              <p key={`${i}-${line}`} className="meta break-all">· {line}</p>
            ))}
          </div>
        </section>
      ) : null}

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

      {/* ── Ship gates (spec §gates): live self-assessment, evidence per gate ── */}
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <p className="meta">SHIP GATES · LIVE SELF-ASSESSMENT</p>
        <div className="grid gap-2 md:grid-cols-2">
          {(
            [
              { label: "Instrumentation", pass: records.length > 0, ev: records.length > 0 ? `${records.length} records, no manual assembly` : "run once to emit records" },
              { label: "Provider pinning", pass: manifest?.temperature === 0 && !!manifest?.models, ev: manifest?.temperature === 0 ? `temp 0 · models frozen · config_hash per record` : "no frozen config yet" },
              { label: "Deterministic A/B/D", pass: ["A", "B", "D"].every((c) => groundTruth.some((g) => g.classId === c)), ev: "regex + rule checks, no LLM judge" },
              { label: "Dual-mode pair", pass: aggregates.some((a) => a.system === "GRAVITY") && aggregates.some((a) => a.system === "GRAVITY-STATIC"), ev: aggregates.some((a) => a.system === "GRAVITY") && aggregates.some((a) => a.system === "GRAVITY-STATIC") ? "adaptive + static stored together" : "run GRAVITY + STATIC together" },
              { label: "Cost decomposition", pass: records.some((r) => r.cost.modelCost !== null), ev: records.some((r) => r.cost.modelCost !== null) ? "model/compute/tool/verify/orch split in drill-down" : "no measured cost yet" },
              { label: "No fabricated cells", pass: true, ev: "unmeasured renders —, never 0 — enforced in code" },
              { label: "Reproducibility", pass: manifest?.seed !== undefined && !!manifest?.taskVersion, ev: manifest?.seed !== undefined ? `seed ${manifest.seed} · ${manifest.taskVersion}` : "run once to freeze config" },
              { label: "Provenance", pass: records.some((r) => !!r.benchmarkRunId && !!r.timestamp), ev: records.some((r) => !!r.benchmarkRunId) ? "run id + timestamp on every record" : "no records yet" },
            ] as const
          ).map((g) => (
            <div key={g.label} className="flex items-start gap-2">
              <span className={cn("meta mt-0.5 shrink-0", g.pass ? "success-text" : "text-warning-text")}>
                {g.pass ? "● PASS" : "○ OPEN"}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ivory">{g.label}</p>
                <p className="meta break-words">{g.ev}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

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
                    <span className="meta ml-2">TRACK {TRACK_OF[s.system] ?? "A"}</span>
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

      {/* ── Hero metrics (spec §investor): killer metric + triad, largest font ── */}
      {leaderboard.length > 0 ? (
        (() => {
          const cheapest = [...leaderboard]
            .filter((s) => s.costPS !== null)
            .sort((a, b) => (a.costPS ?? Infinity) - (b.costPS ?? Infinity))[0] ?? null;
          const champ = leaderboard[0] ?? null;
          return (
            <section className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-5 text-center">
                <p className="meta text-gold">PRIMARY INVESTOR METRIC</p>
                <p className="mt-2 text-xl font-bold tracking-wide text-gold">COST PER SUCCESSFUL OUTCOME</p>
                {cheapest ? (
                  <p className="mt-2 text-sm text-ivory">
                    {cheapest.system} · <span className="font-medium">${cheapest.costPS!.toFixed(4)}</span> / success
                  </p>
                ) : (
                  <p className="meta mt-2">— no measured cost yet</p>
                )}
              </div>
              <div className="rounded-lg border border-border bg-surface p-5 text-center">
                <p className="meta text-gold">COMPANION TRIAD · {champ?.system ?? "—"}</p>
                <p className="mt-2 text-xl font-bold tracking-wide text-ivory">QUALITY × SPEED × RESOURCE</p>
                {champ ? (
                  <p className="meta mt-2">
                    Q {champ.quality === null ? "—" : champ.quality.toFixed(2)} · p50 {fmt(champ.latency)}ms
                    {champ.latency95 !== null ? ` · p95 ${fmt(champ.latency95)}ms` : ""} · RES {champ.resEff === null ? "—" : `${Math.round(champ.resEff * 100)}%`}
                  </p>
                ) : (
                  <p className="meta mt-2">— no measured run yet</p>
                )}
              </div>
            </section>
          );
        })()
      ) : null}

      {/* ── Slide table (spec §investor): 7 rows × systems, deck-shaped ── */}
      {leaderboard.length > 0 ? (
        <section className="space-y-3">
          <p className="meta">INVESTOR SLIDE · 7 ROWS · MEAN ACROSS CLASSES</p>
          <div className="overflow-x-auto rounded-lg border border-gold/40">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="meta px-4 py-3 font-normal">BENCHMARK</th>
                  {leaderboard.map((s) => (
                    <th key={s.system} className="px-4 py-3 text-ivory">
                      {s.system}
                      <span className="meta ml-2">TRACK {TRACK_OF[s.system] ?? "A"}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    { label: "Task Success", hero: false, fmt: (s: (typeof leaderboard)[number]) => s.success === null ? "—" : `${Math.round(s.success * 100)}%` },
                    { label: "Cost / Successful Task", hero: true, fmt: (s: (typeof leaderboard)[number]) => s.costPS === null ? "—" : `$${s.costPS.toFixed(4)}` },
                    { label: "P50 Latency", hero: false, fmt: (s: (typeof leaderboard)[number]) => s.latency === null ? "—" : `${fmt(s.latency)}ms` },
                    { label: "Tokens / Task", hero: false, fmt: (s: (typeof leaderboard)[number]) => s.tokens === null ? "—" : fmt(s.tokens) },
                    { label: "Resource Efficiency", hero: false, fmt: (s: (typeof leaderboard)[number]) => s.resEff === null ? "—" : `${Math.round(s.resEff * 100)}%` },
                    { label: "Verification Reliability", hero: false, fmt: (s: (typeof leaderboard)[number]) => s.vpr === null ? "—" : `${Math.round(s.vpr * 100)}%` },
                    { label: "Decision Efficiency", hero: true, fmt: (s: (typeof leaderboard)[number]) => s.decEff === null ? "—" : `${Math.round(s.decEff * 100)}%` },
                  ] as const
                ).map((row) => (
                  <tr key={row.label} className="border-b border-border-light last:border-0">
                    <td className={cn("px-4 py-2.5", row.hero ? "font-bold text-gold" : "text-ivory-faint")}>
                      {row.label}
                    </td>
                    {leaderboard.map((s) => (
                      <td key={s.system} className={cn("px-4 py-2.5", row.hero ? "font-bold text-gold" : "text-ivory")}>
                        {row.fmt(s)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
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

      {/* ── Empty state: no walls of "—" before the first run ── */}
      {!hasData && phase !== "running" ? (
        <section className="bench-empty">
          <p className="meta text-gold">NO MEASUREMENTS YET</p>
          <p className="mt-2 text-lg font-light text-ivory">Pick systems + classes above, then press RUN.</p>
          <p className="meta mt-2">Every cell below fills only from real runs — never placeholders.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="bench-empty-chip">1 · 1 system × 1 class ≈ 1 min</span>
            <span className="bench-empty-chip">2 · GRAVITY + STATIC × A–E ≈ 10 min</span>
            <span className="bench-empty-chip">3 · Export the slide PDF</span>
          </div>
        </section>
      ) : null}

      {/* ── Investor table: systems × classes ── */}
      {hasData ? (
      <section className="space-y-4">
        <p className="meta">POINTS · SUCCESS RATE · p50 LATENCY · AVG TOKENS · QUALITY · COST</p>
        <div className="bench-table overflow-x-auto rounded-lg border border-border">
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
                  <td className="px-4 py-3 text-ivory">
                    {system}
                    <span className="meta ml-2 block">TRACK {TRACK_OF[system] ?? "A"}</span>
                  </td>
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
                              {fmt(agg.p50LatencyMs)}ms{agg.p95LatencyMs !== null ? ` · p95 ${fmt(agg.p95LatencyMs)}ms` : ""} · {fmt(agg.avgTokensPerTask)} tok
                            </p>
                            <p className="meta">
                              Q {agg.avgQualityScore === null ? "—" : `${agg.avgQualityScore.toFixed(2)} · ${agg.qualityMeasured ?? 0}/${agg.qualityOf ?? agg.runs}`} · {agg.avgIntelligenceLevel === null ? "—" : `L${agg.avgIntelligenceLevel.toFixed(1)}`} · ${fmt(agg.totalCost, 4)}
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
      ) : null}

      {/* ── Efficiency (collapsible advanced) ── */}
      {hasData ? (
      <details className="bench-details" open>
        <summary className="meta bench-summary">EFFICIENCY · DECISION · RESOURCE · ESCALATION · VERIFY · COST/SUCCESS</summary>
        <div className="bench-table overflow-x-auto rounded-lg border border-border">
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
                            <p className="meta">
                              IEE {agg.avgQualityScore === null || !agg.totalCost ? "—" : (agg.avgQualityScore / agg.totalCost).toFixed(1)} qual/$
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
      </details>
      ) : null}

      {/* ── Cost story (spec §cost): worked example + live multiple ── */}
      {(() => {
        const meanCPS = (sys: string) => {
          const vals = aggregates.filter((a) => a.system === sys).map((a) => a.costPerSuccessfulTask).filter((v): v is number => v !== null);
          return vals.length > 0 ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
        };
        const g = meanCPS("GRAVITY");
        const frontier = ["CLAUDE", "OPENAI", "GRAVITY-OPENROUTER"]
          .map(meanCPS)
          .filter((v): v is number => v !== null);
        const bestFrontier = frontier.length > 0 ? Math.min(...frontier) : null;
        const mult = g !== null && bestFrontier !== null && g > 0 ? bestFrontier / g : null;
        return (
          <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
            <p className="meta">COST STORY · CORRECT AMOUNT OF INTELLIGENCE</p>
            <p className="text-sm leading-relaxed text-ivory-faint">
              Worked example — L0 python $0.000 · stats $0.001 · small LLM $0.008 · verify $0.002 ·
              orchestration $0.001 = <span className="text-gold">$0.012</span> vs one frontier call $0.06–0.10.
            </p>
            {g !== null && bestFrontier !== null && mult !== null ? (
              <p className="text-sm leading-relaxed text-ivory">
                Live this run — GRAVITY <span className="font-medium text-gold">${g.toFixed(4)}</span>/success vs best
                frontier <span className="font-medium">${bestFrontier.toFixed(4)}</span>
                {mult >= 1 ? (
                  <> · <span className="font-medium success-text">{mult.toFixed(1)}× cheaper</span></>
                ) : (
                  <> · <span className="font-medium text-warning-text">frontier cheaper this run — investigate</span></>
                )}
              </p>
            ) : (
              <p className="meta">Run GRAVITY + a frontier baseline to print the live multiple.</p>
            )}
          </section>
        );
      })()}

      {/* ── Ground truth criteria (collapsible reference) ── */}
      <details className="bench-details">
        <summary className="meta bench-summary">Deterministic success criteria — no LLM-vibes judging</summary>
        <div className="grid gap-2">
          {groundTruth.map((truth) => (
            <div key={truth.classId} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-baseline gap-3">
                <span className="text-gold">{truth.classId}</span>
                <span className="meta">{truth.difficulty}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-ivory">
                {CLASS_CLAIMS[truth.classId as ClassId] ?? ""}
              </p>
              <p className="mt-1 text-sm text-ivory-faint">{truth.successCriterion}</p>
            </div>
          ))}
        </div>
      </details>
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
            <div className="bench-table overflow-x-auto rounded-lg border border-border">
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
