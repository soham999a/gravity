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
}

export interface RunnerResult {
  manifest: BenchmarkRunManifest;
  records: BenchmarkRecord[];
  aggregates: BenchmarkAggregate[];
  /** Systems requested but honestly skipped (e.g. JEV not wired). */
  skippedSystems: { system: BenchmarkSystem; reason: string }[];
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
): Promise<BenchmarkRecord> {
  switch (system) {
    case "GRAVITY":
      return runGravityTask(true, def, runId);
    case "GRAVITY-STATIC":
      return runGravityTask(false, def, runId);
    case "GRAVITY-OPENROUTER":
      return runPinnedBaselineTask("GRAVITY-OPENROUTER", def, runId);
    case "CLAUDE":
      return runPinnedBaselineTask("CLAUDE", def, runId);
    case "OPENAI":
      return runPinnedBaselineTask("OPENAI", def, runId);
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
  const runId = `bench-${seed}-${Date.now().toString(36)}`;
  const startedAt = new Date().toISOString();
  const records: BenchmarkRecord[] = [];
  const skippedSystems: RunnerResult["skippedSystems"] = [];

  const taskDefs = loadTaskDefs(classes).map(freezeTask);
  const total = taskDefs.length * runsPerClass * systems.length;
  let current = 0;

  for (const def of taskDefs) {
    for (let run = 0; run < runsPerClass; run += 1) {
      for (const system of systems) {
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
          const stubRecord = await dispatchAdapter(system, def, runId);
          records.push(mergeVerdict(stubRecord, evaluateRecord(def.id, stubRecord)));
          continue;
        }

        // Box 2 → Box 3 → Box 4
        const record = await dispatchAdapter(system, def, runId);
        const verdict = evaluateRecord(def.id, record);
        records.push(mergeVerdict(record, verdict));
      }
    }
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
  };

  return { manifest, records, aggregates: groupAggregates(records), skippedSystems };
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
