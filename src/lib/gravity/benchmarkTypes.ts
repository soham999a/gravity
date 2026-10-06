/**
 * BenchmarkRecord — the common measurement language from the senior's
 * "GRAVITY — Benchmark Harness & Evaluation Specification".
 *
 * One schema. Every system. Every run. Fields that cannot be measured for a
 * given system are stored as `null` and rendered as "—" — never fabricated.
 *
 * Server-side port of the intelligence-fabric schema. Records are emitted by
 * the backend (never the chat UI) and persisted to Firestore.
 */

export type BenchmarkSystem =
  | "GRAVITY"
  | "GRAVITY-STATIC"
  | "GRAVITY-OPENROUTER"
  | "JEV"
  | "CLAUDE"
  | "OPENAI";

export type WorkloadClass = "A" | "B" | "C" | "D" | "E";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type VerificationStatus = "PASS" | "FAIL" | "INSUFFICIENT" | "SKIPPED";
export type RunMode = "ADAPTIVE" | "STATIC";

/** Spec §Cost Model: C_total = C_compute + C_intel + C_storage + C_other.
 *  Any component the system under test cannot expose stays null (honest None,
 *  rendered as "—") — never 0, which would fake symmetry between systems. */
export interface CostDecomposition {
  modelCost: number | null;
  computeCost: number | null;
  toolCost: number | null;
  verificationCost: number | null;
  orchestrationCost: number | null;
  totalCost: number | null;
}

export interface BenchmarkRecord {
  // ── Identity ─────────────────────────────
  taskId: string;
  taskVersion: string;
  workloadClass: WorkloadClass;

  // ── System ───────────────────────────────
  system: BenchmarkSystem;
  runMode: RunMode;
  model: string | null;
  provider: string | null;
  modelVersion: string | null;
  configHash: string;

  // ── Task metadata ────────────────────────
  difficulty: Difficulty;
  successCriterion: string;

  // ── Outcome ──────────────────────────────
  success: boolean;
  qualityScore: number | null;
  correctness: number | null;
  completeness: number | null;
  verificationStatus: VerificationStatus;

  // ── Token / call accounting ──────────────
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cachedTokens: number | null;
  modelCalls: number;
  toolCalls: number;
  retries: number;
  escalations: number;

  // ── Timing ───────────────────────────────
  latencyMs: number;
  ttftMs: number | null;

  // ── Resource consumption ─────────────────
  cpuSeconds: number | null;
  gpuSeconds: number | null;
  memoryGbSeconds: number | null;
  parallelWorkers: number;
  peakConcurrency: number;

  // ── Economics ────────────────────────────
  cost: CostDecomposition;

  /** Raw output + evaluation evidence, per the adapter contract:
   *  raw_text for the evaluator, error on failed runs, evidence after merge.
   *  A missing row is worse than a failed row — errors are records too. */
  metadata: Record<string, unknown> | null;

  // ── GRAVITY-specific ─────────────────────
  intelligenceLevel: number | null;
  route: string[] | null;
  earlyStop: boolean | null;
  resourceEfficiency: number | null;
  decisionEfficiency: number | null;
  escalationEfficiency: number | null;

  // ── Provenance ───────────────────────────
  policyVersion: string | null;
  benchmarkRunId: string;
  timestamp: string;
}

/** Aggregates over N runs of one (system, workloadClass) pair. */
export interface BenchmarkAggregate {
  system: BenchmarkSystem;
  workloadClass: WorkloadClass;
  runs: number;
  taskSuccessRate: number | null;
  costPerSuccessfulTask: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  avgTokensPerTask: number | null;
  avgModelCallsPerTask: number | null;
  avgIntelligenceLevel: number | null;
  escalationRate: number | null;
  verificationPassRate: number | null;
  decisionEfficiency: number | null;
  resourceEfficiency: number | null;
  totalCost: number | null;
}

/** A full benchmark execution: N tasks × systems × modes. */
export interface BenchmarkRunManifest {
  runId: string;
  seed: number;
  startedAt: string;
  completedAt?: string;
  taskVersion: string;
  systems: BenchmarkSystem[];
  workloadClasses: WorkloadClass[];
  runsPerClass: number;
  recordCount: number;
}

export const TASK_VERSION = "workload-classes-v1";

/** Deterministic config fingerprint per the spec's "Configuration to Freeze"
 *  — SHA-256 over system|model|temperature|maxTokens|prompt, so any config
 *  change between runs is detectable from the record itself. */
export async function configHash(parts: {
  system: BenchmarkSystem;
  model: string | null;
  temperature: number;
  maxTokens: number;
  prompt: string;
}): Promise<string> {
  const raw = [parts.system, parts.model ?? "none", parts.temperature, parts.maxTokens, parts.prompt].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return `sha256:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return Math.max(0, Math.round(sorted[Math.max(0, index)]!));
}

/** Seeded PRNG (mulberry32) so runs are reproducible per the spec. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function aggregateRecords(records: BenchmarkRecord[]): BenchmarkAggregate {
  const successful = records.filter((record) => record.success);
  const latencies = records.map((record) => record.latencyMs);
  // null cost components (honest None) contribute nothing rather than faking 0.
  const totalCost = records.reduce((sum, record) => sum + (record.cost.totalCost ?? 0), 0);
  const tokens = records.map(
    (record) => (record.inputTokens ?? 0) + (record.outputTokens ?? 0),
  );
  const levels = records
    .map((record) => record.intelligenceLevel)
    .filter((level): level is number => level !== null);
  const escalations = records.reduce((sum, record) => sum + record.escalations, 0);
  const verifications = records.filter(
    (record) => record.verificationStatus !== "SKIPPED",
  );
  const verificationPasses = verifications.filter(
    (record) => record.verificationStatus === "PASS",
  );

  // Decision efficiency: necessary actions / total actions, where an action is
  // a model or tool call. Necessary = calls on successful tasks (their work was
  // needed to produce the accepted outcome); calls on failed tasks are waste.
  const totalActions = records.reduce(
    (sum, record) => sum + record.modelCalls + record.toolCalls,
    0,
  );
  const necessaryActions = successful.reduce(
    (sum, record) => sum + record.modelCalls + record.toolCalls,
    0,
  );

  const resourceEligible = records.filter(
    (record) => record.resourceEfficiency !== null,
  );

  return {
    system: records[0]?.system ?? "GRAVITY",
    workloadClass: records[0]?.workloadClass ?? "A",
    runs: records.length,
    taskSuccessRate: records.length > 0 ? successful.length / records.length : null,
    costPerSuccessfulTask:
      successful.length > 0 ? totalCost / successful.length : null,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    p99LatencyMs: percentile(latencies, 99),
    avgTokensPerTask:
      records.length > 0
        ? tokens.reduce((a, b) => a + b, 0) / records.length
        : null,
    avgModelCallsPerTask:
      records.length > 0
        ? records.reduce((sum, record) => sum + record.modelCalls, 0) / records.length
        : null,
    avgIntelligenceLevel:
      levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : null,
    escalationRate: records.length > 0 ? escalations / records.length : null,
    verificationPassRate:
      verifications.length > 0 ? verificationPasses.length / verifications.length : null,
    decisionEfficiency: totalActions > 0 ? necessaryActions / totalActions : null,
    resourceEfficiency:
      resourceEligible.length === records.length && records.length > 0
        ? resourceEligible.reduce(
            (sum, record) => sum + (record.resourceEfficiency ?? 0),
            0,
          ) / records.length
        : null,
    totalCost: records.length > 0 ? totalCost : null,
  };
}
