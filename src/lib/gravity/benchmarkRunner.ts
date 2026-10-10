/**
 * BenchmarkRunner — the senior's "exact graph" made executable.
 *
 *   Box 1 (Loader)      — freezes the task def + prompt, pins config
 *   Box 2 (Adapter)     — benchmarkAdapters.ts: one call per system → partial record
 *   Box 3 (Evaluator)   — benchmarkEval.ts: deterministic verdict + evidence
 *   Box 4 (Normalizer)  — THIS file merges verdict → record → store
 *
 * Discipline: deterministic success criteria, measured values only, honest
 * nulls where a field cannot be measured. Records are emitted server-side and
 * persisted — never the chat UI.
 */

import {
  WORKLOAD_CLASSES,
  type WorkloadClassDef,
  type WorkloadClassId,
} from "./classes";
import {
  runGravityTask,
  runPinnedBaselineTask,
  runJevTask,
  classDifficulty,
  PINNED_CONFIG,
  JEV_WIRED,
} from "./benchmarkAdapters";
import { evaluateRecord, type EvalVerdict } from "./benchmarkEval";
import {
  aggregateRecords,
  seededRandom,
  TASK_VERSION,
  type BenchmarkAggregate,
  type BenchmarkRecord,
  type BenchmarkRunManifest,
  type BenchmarkSystem,
} from "./benchmarkTypes";

// ─────────────────────────────────────────────────────────────
// Box 1 — Loader: freeze the task set, pin the config hash.
// ─────────────────────────────────────────────────────────────

export interface RunnerProgress {
  current: number;
  total: number;
  label: string;
}

export interface RunnerOptions {
  systems?: BenchmarkSystem[];
  classes?: WorkloadClassId[];
  runsPerClass?: number;
  seed?: number;
  onProgress?: (progress: RunnerProgress) => void;
  /** Cooperative cancellation: stops the queue, abandons queued jobs, and
   *  discards late results. In-flight pipeline jobs run to their own
   *  deadlines (bounded) but their records are dropped, never persisted. */
  signal?: AbortSignal;
  /** Append mode (chunked runs): reuse this runId instead of minting one. */
  runId?: string;
}

export interface RunnerResult {
  manifest: BenchmarkRunManifest;
  records: BenchmarkRecord[];
  aggregates: BenchmarkAggregate[];
  /** Systems requested but honestly skipped (e.g. JEV not wired). */
  skippedSystems: { system: BenchmarkSystem; reason: string }[];
  /** True when cancellation stopped the run early (partial records). */
  aborted: boolean;
}

/** Process-wide class-E mutex. The injected-failure flag is global one-shot
 *  state — E jobs from ANY concurrent run must serialize around
 *  set→execute→clear or parallel runs steal each other's failure. */
let eMutex: Promise<void> = Promise.resolve();

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = eMutex.then(fn, fn);
  // Keep the chain alive even if a job rejects.
  eMutex = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

class AbortedError extends Error {
  constructor() {
    super("benchmark run aborted");
    this.name = "AbortedError";
  }
}

/** Adapters throw plain Errors named AbortedError (no import cycle) — match both. */
function isAbort(err: unknown, signal?: AbortSignal): boolean {
  return (
    err instanceof AbortedError ||
    (err instanceof Error && err.name === "AbortedError") ||
    signal?.aborted === true
  );
}

const ALL_CLASS_IDS: WorkloadClassId[] = ["A", "B", "C", "D", "E"];
const DEFAULT_SYSTEMS: BenchmarkSystem[] = ["GRAVITY", "GRAVITY-STATIC"];

function loadTaskDefs(classes: WorkloadClassId[]): WorkloadClassDef[] {
  return WORKLOAD_CLASSES.filter((def) => classes.includes(def.id));
}

/** Pin the task def + metadata before any adapter sees it (spec Box 1). */
function freezeTask(def: WorkloadClassDef): WorkloadClassDef & { difficulty: string } {
  return { ...def, difficulty: classDifficulty(def) };
}

// ─────────────────────────────────────────────────────────────
// Box 2 dispatch — one adapter call per system.
// ─────────────────────────────────────────────────────────────

async function dispatchAdapter(
  system: BenchmarkSystem,
  def: WorkloadClassDef,
  runId: string,
  signal?: AbortSignal,
): Promise<BenchmarkRecord> {
  switch (system) {
    case "GRAVITY":
      return runGravityTask(true, def, runId, signal);
    case "GRAVITY-STATIC":
      return runGravityTask(false, def, runId, signal);
    case "GRAVITY-OPENROUTER":
      return runPinnedBaselineTask("GRAVITY-OPENROUTER", def, runId, signal);
    case "CLAUDE":
      return runPinnedBaselineTask("CLAUDE", def, runId, signal);
    case "OPENAI":
      return runPinnedBaselineTask("OPENAI", def, runId, signal);
    case "JEV":
      return runJevTask(def, runId);
  }
}

// ─────────────────────────────────────────────────────────────
// Box 4 — Normalizer: merge evaluator verdict into the adapter's record,
// attach evidence, and hand off to the store.
// ─────────────────────────────────────────────────────────────

function mergeVerdict(record: BenchmarkRecord, verdict: EvalVerdict): BenchmarkRecord {
  return {
    ...record,
    success: verdict.success ?? false,
    qualityScore: verdict.qualityScore,
    correctness: verdict.correctness,
    completeness: record.completeness ?? verdict.completeness,
    verificationStatus: verdict.verificationStatus,
    metadata: { ...(record.metadata ?? {}), evidence: verdict.evidence },
  };
}

export async function runBenchmark(options: RunnerOptions = {}): Promise<RunnerResult> {
  const systems = options.systems ?? DEFAULT_SYSTEMS;
  const classes = options.classes ?? ALL_CLASS_IDS;
  const runsPerClass = Math.max(1, options.runsPerClass ?? 1);
  const seed = options.seed ?? 42;
  const rand = seededRandom(seed); // bookkeeping parity with manifest; task order stays frozen per spec
  void rand;
  const runId = options.runId ?? `bench-${seed}-${Date.now().toString(36)}`;
  const startedAt = new Date().toISOString();
  const records: BenchmarkRecord[] = [];
  const skippedSystems: RunnerResult["skippedSystems"] = [];
  let aborted = false;

  const taskDefs = loadTaskDefs(classes).map(freezeTask);
  const total = taskDefs.length * runsPerClass * systems.length;
  // Guard: a full 5×3×6 = 90 live missions can never fit in one
  // serverless invocation (vercel maxDuration 120s). Fail fast with guidance
  // instead of timing out halfway and persisting a partial run.
  const MAX_COMBOS = 30;
  if (total > MAX_COMBOS) {
    throw new Error(
      `Benchmark too large: ${total} combos (systems × classes × runs). Max ${MAX_COMBOS} per run ` +
        `— pick fewer systems/classes or runsPerClass=1. E.g. 2 systems × 5 classes × 1 run = 10.`,
    );
  }
  let current = 0;

  // Build a flat job list so independent (system, class, run) pairs can run
  // with limited concurrency instead of fully sequentially.
  // Exception: Class E arms a global one-shot failure flag
  // (__gravity_inject_failure__ in classes.ts) — E jobs must stay serial
  // or parallel runs would steal each other's injected failure.
  type Job = { def: (typeof taskDefs)[number]; run: number; system: BenchmarkSystem };
  const allJobs: Job[] = [];
  for (const def of taskDefs) {
    for (let run = 0; run < runsPerClass; run += 1) {
      for (const system of systems) {
        allJobs.push({ def, run, system });
      }
    }
  }
  const parallelJobs = allJobs.filter((j) => j.def.id !== "E");
  const serialJobs = allJobs.filter((j) => j.def.id === "E");

  const CONCURRENCY = 3;
  const TASK_TIMEOUT_MS = 50_000;

  async function runOneJob(job: Job): Promise<BenchmarkRecord> {
    const { def, run, system } = job;
    if (options.signal?.aborted) throw new AbortedError();
    current += 1;
    options.onProgress?.({
      current,
      total,
      label: `${system} · class ${def.id} · run ${run + 1}/${runsPerClass}`,
    });

    if (system === "JEV" && !JEV_WIRED) {
      if (!skippedSystems.some((skip) => skip.system === system)) {
        skippedSystems.push({
          system,
          reason: "JEV adapter declared in the graph but its REST API is not wired into this deployment.",
        });
      }
      // Still run the stub so the record shows the honest UNSUPPORTED error.
      const stubRecord = await dispatchAdapter(system, def, runId, options.signal);
      return mergeVerdict(stubRecord, evaluateRecord(def.id, stubRecord));
    }

    // Box 2 → Box 3 → Box 4, with a per-task timeout so one hung LLM call
    // can't wedge the whole run into a Vercel timeout with zero records.
    const work = (async () => {
      const record = await dispatchAdapter(system, def, runId, options.signal);
      if (options.signal?.aborted) throw new AbortedError();
      const verdict = evaluateRecord(def.id, record);
      return mergeVerdict(record, verdict);
    })();
    const timeout = new Promise<BenchmarkRecord>((resolve) => {
      setTimeout(() => {
        resolve({
          taskId: `wlc-${def.id}`,
          taskVersion: TASK_VERSION,
          workloadClass: def.id,
          system,
          runMode: system.startsWith("GRAVITY") && system !== "GRAVITY-OPENROUTER" ? "ADAPTIVE" : "STATIC",
          model: null,
          provider: null,
          modelVersion: null,
          configHash: "",
          difficulty: "MEDIUM",
          successCriterion: "",
          success: false,
          qualityScore: null,
          correctness: null,
          completeness: null,
          verificationStatus: "FAIL",
          inputTokens: null,
          outputTokens: null,
          reasoningTokens: null,
          cachedTokens: null,
          modelCalls: 0,
          toolCalls: 0,
          retries: 0,
          escalations: 0,
          latencyMs: TASK_TIMEOUT_MS,
          ttftMs: null,
          cpuSeconds: null,
          gpuSeconds: null,
          memoryGbSeconds: null,
          parallelWorkers: 1,
          peakConcurrency: 1,
          cost: {
            modelCost: null,
            computeCost: null,
            toolCost: null,
            verificationCost: null,
            orchestrationCost: null,
            totalCost: null,
          },
          metadata: {
            error: `task timeout after ${TASK_TIMEOUT_MS}ms — adapter hung (likely LLM throttle)`,
            error_type: "task_timeout",
          },
          intelligenceLevel: null,
          route: null,
          earlyStop: null,
          resourceEfficiency: null,
          decisionEfficiency: null,
          escalationEfficiency: null,
          policyVersion: null,
          benchmarkRunId: runId,
          timestamp: new Date().toISOString(),
        });
      }, TASK_TIMEOUT_MS);
    });
    return Promise.race([work, timeout]);
  }

  // Limited-concurrency pool for non-E jobs. Abort-aware: workers stop
  // pulling the moment cancellation lands; in-flight jobs race their own
  // timeout and their late results are discarded below, never persisted.
  const out: (BenchmarkRecord | null)[] = new Array(allJobs.length).fill(null);
  const jobIndex = new Map(allJobs.map((j, i) => [j, i]));
  async function worker(queue: Job[]) {
    while (queue.length > 0) {
      if (options.signal?.aborted) {
        aborted = true;
        return;
      }
      const job = queue.shift()!;
      try {
        out[jobIndex.get(job)!] = await runOneJob(job);
      } catch (err) {
        if (isAbort(err, options.signal)) {
          aborted = true;
          return;
        }
        throw err;
      }
    }
  }
  const queue = [...parallelJobs];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker(queue)),
  );
  // Class E strictly serial, in original order — inside the process-wide
  // mutex so concurrent runs can't steal each other's injected failure.
  for (const job of serialJobs) {
    if (options.signal?.aborted) {
      aborted = true;
      break;
    }
    try {
      out[jobIndex.get(job)!] = await runExclusive(() => runOneJob(job));
    } catch (err) {
      if (isAbort(err, options.signal)) {
        aborted = true;
        break;
      }
      throw err;
    }
  }
  // Reassemble in the original frozen task order (A→E), dropping nulls
  // (aborted or never-started jobs leave no fake rows).
  for (const job of allJobs) {
    const rec = out[jobIndex.get(job)!];
    if (rec) records.push(rec);
  }

  const manifest: BenchmarkRunManifest = {
    runId,
    seed,
    startedAt,
    completedAt: new Date().toISOString(),
    taskVersion: TASK_VERSION,
    systems,
    workloadClasses: taskDefs.map((def) => def.id),
    runsPerClass,
    recordCount: records.length,
    // Frozen decoding config — the onboarding spec's reproducibility core.
    temperature: PINNED_CONFIG.TEMPERATURE,
    maxTokens: PINNED_CONFIG.MAX_TOKENS,
    models: Object.fromEntries(
      systems.map((system) => [
        system,
        system === "GRAVITY" || system === "GRAVITY-STATIC"
          ? (process.env.GEMINI_MODEL ?? "gemini-2.5-flash")
          : system === "CLAUDE"
            ? PINNED_CONFIG.CLAUDE_MODEL
            : system === "OPENAI"
              ? PINNED_CONFIG.OPENAI_MODEL
              : system === "GRAVITY-OPENROUTER"
                ? PINNED_CONFIG.OPENROUTER_MODEL
                : null,
      ]),
    ) as BenchmarkRunManifest["models"],
  };

  return { manifest, records, aggregates: groupAggregates(records), skippedSystems, aborted };
}

/** Group records by (system, class) and aggregate each group (Lab UI table). */
export function groupAggregates(records: BenchmarkRecord[]): BenchmarkAggregate[] {
  const groups = new Map<string, BenchmarkRecord[]>();
  for (const record of records) {
    const key = `${record.system}:${record.workloadClass}`;
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  return [...groups.values()].map((groupRecords) => aggregateRecords(groupRecords));
}

// ─────────────────────────────────────────────────────────────
// CSV export — investor table format. Unmeasured cells stay blank (honest
// None), never a fabricated 0.
// ─────────────────────────────────────────────────────────────

export function recordsToCsv(records: BenchmarkRecord[]): string {
  const headers = [
    "task_id", "workload_class", "system", "run_mode", "model", "provider",
    "difficulty", "success", "verification_status", "quality_score",
    "input_tokens", "output_tokens", "cached_tokens", "model_calls", "tool_calls",
    "retries", "escalations", "latency_ms", "intelligence_level", "route",
    "early_stop", "resource_efficiency", "decision_efficiency", "escalation_efficiency",
    "policy_version", "model_cost", "compute_cost", "tool_cost", "verification_cost",
    "orchestration_cost", "total_cost", "config_hash", "benchmark_run_id", "timestamp",
  ];
  const blank = (value: number | string | boolean | string[] | null | undefined) =>
    value === null || value === undefined ? "" : Array.isArray(value) ? value.join("->") : String(value);
  const rows = records.map((record) =>
    [
      record.taskId, record.workloadClass, record.system, record.runMode,
      record.model, record.provider, record.difficulty, String(record.success),
      record.verificationStatus, blank(record.qualityScore),
      blank(record.inputTokens), blank(record.outputTokens), blank(record.cachedTokens),
      String(record.modelCalls), String(record.toolCalls), String(record.retries),
      String(record.escalations), String(record.latencyMs),
      blank(record.intelligenceLevel), blank(record.route),
      blank(record.earlyStop), blank(record.resourceEfficiency),
      blank(record.decisionEfficiency), blank(record.escalationEfficiency),
      blank(record.policyVersion),
      blank(record.cost.modelCost), blank(record.cost.computeCost),
      blank(record.cost.toolCost), blank(record.cost.verificationCost),
      blank(record.cost.orchestrationCost), blank(record.cost.totalCost),
      record.configHash, record.benchmarkRunId, record.timestamp,
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
