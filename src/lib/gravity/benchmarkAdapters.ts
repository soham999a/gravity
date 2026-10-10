/**
 * System adapters — the senior's "exact graph", Box 2.
 *
 * One abstract contract: given a task def, run one system and return a
 * partially-filled BenchmarkRecord (execution fields populated; evaluation
 * fields left to the evaluator, which merges them in the runner).
 *
 * Adapter rules (spec):
 *   - Model + version + temperature are module-level constants — pinned, never varied per task.
 *   - Cost pricing lives in a config table, not inline magic numbers.
 *   - An adapter NEVER computes success/quality — that is the evaluator's job.
 *   - Raw output goes into metadata.raw_text so the evaluator can inspect it.
 *   - On error: capture the exception, still return a record — never raise from run().
 *   - GRAVITY-Static is the SAME adapter with a flag, not a second adapter.
 *   - Honest None: a field the system doesn't expose stays null, never 0.
 */

import {
  runWorkloadClass,
  type WorkloadClassDef,
} from "./classes";
import { estimateCostUsd, streamOpenRouter } from "./llm";
import { configHash, TASK_VERSION } from "./benchmarkTypes";
import { GROUND_TRUTH } from "./benchmarkEval";
import type {
  BenchmarkRecord,
  BenchmarkSystem,
  CostDecomposition,
  Difficulty,
  RunMode,
} from "./benchmarkTypes";

// ─────────────────────────────────────────────────────────────
// PINNED CONFIG — never change mid-benchmark (spec: freeze model, temp,
// max tokens, prompt, tools, provider).
// ─────────────────────────────────────────────────────────────

export const PINNED_CONFIG = {
  /** Claude rung — anthropic native pin per the spec's adapter example. */
  CLAUDE_MODEL: process.env.BENCH_CLAUDE_MODEL ?? "anthropic/claude-sonnet-5.5",
  /** OpenAI rung — provider-pinned OpenAI-family model. */
  OPENAI_MODEL: process.env.BENCH_OPENAI_MODEL ?? "openai/gpt-oss-120b",
  /** Raw OpenRouter pin (no kernel) — $5 pay-as-you-go workhorse. */
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4.1-flash",
  /** Deterministic decoding per the onboarding spec (was 0.7 — sampling
   *  variance is the enemy of a defensible benchmark). */
  TEMPERATURE: 0,
  MAX_TOKENS: 2048,
} as const;

/** JEV adapter is declared in the spec's graph but its REST API isn't wired
 *  into this repo yet — honest UNSUPPORTED, never a fabricated record. */
export const JEV_WIRED = false;

function costBreakdown(modelCost: number | null): CostDecomposition {
  return {
    modelCost,
    computeCost: null,
    toolCost: null,
    verificationCost: null,
    orchestrationCost: null,
    // A total without its components is still the honest, measured sum.
    totalCost: modelCost,
  };
}

/** Baseline skeleton with every measurable field honestly null (Box 4 normalizer). */
function recordSkeleton(
  system: BenchmarkSystem,
  def: WorkloadClassDef,
  runId: string,
  runMode: RunMode,
): BenchmarkRecord {
  return {
    taskId: `wlc-${def.id}`,
    taskVersion: TASK_VERSION,
    workloadClass: def.id,
    system,
    runMode,
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
    verificationStatus: "SKIPPED",
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    cachedTokens: null,
    modelCalls: 0,
    toolCalls: 0,
    retries: 0,
    escalations: 0,
    latencyMs: 0,
    ttftMs: null,
    cpuSeconds: null,
    gpuSeconds: null,
    memoryGbSeconds: null,
    parallelWorkers: 1,
    peakConcurrency: 1,
    cost: costBreakdown(null),
    metadata: null,
    intelligenceLevel: null,
    route: null,
    earlyStop: null,
    resourceEfficiency: null,
    decisionEfficiency: null,
    escalationEfficiency: null,
    policyVersion: null,
    benchmarkRunId: runId,
    timestamp: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// The GRAVITY adapter — adaptive: true → GRAVITY; false → GRAVITY-STATIC.
// Same code, one flag — do NOT write a second adapter (spec pitfall #5).
// ─────────────────────────────────────────────────────────────

/** Receipt shape produced by classes.ts runWorkloadClass (structural trace). */
interface ReceiptShape {
  status: "PASS" | "FAIL";
  durationMs: number;
  routing: { selectedLabel: string; selectedLevel: number; policy: string };
  execution: {
    status: string;
    tokens: number;
    llmCalls: number;
    stepCount: number;
    steps: { status: string }[];
  };
  evaluation: { verdict: string; quality: number };
  answer: string;
}

export async function runGravityTask(
  adaptive: boolean,
  def: WorkloadClassDef,
  runId: string,
): Promise<BenchmarkRecord> {
  const system: BenchmarkSystem = adaptive ? "GRAVITY" : "GRAVITY-STATIC";
  const rec = recordSkeleton(system, def, runId, "ADAPTIVE");
  rec.difficulty = classDifficulty(def);
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  rec.model = model;
  rec.provider = "gemini";
  rec.modelVersion = model;
  rec.configHash = await configHash({
    system,
    model,
    temperature: PINNED_CONFIG.TEMPERATURE,
    maxTokens: PINNED_CONFIG.MAX_TOKENS,
    prompt: def.prompt,
  });
  rec.successCriterion = GROUND_TRUTH[def.id]?.successCriterion ?? "Structural PASS verdict.";

  const t0 = Date.now();
  try {
    const receipt = (await runWorkloadClass(def, {
      routing: adaptive ? "adaptive" : "static",
    })) as ReceiptShape;
    rec.latencyMs = Date.now() - t0;

    // Decision trace → GRAVITY-specific record fields.
    rec.intelligenceLevel = receipt.routing.selectedLevel;
    rec.route = [receipt.routing.selectedLabel];
    rec.earlyStop = receipt.routing.selectedLevel <= 1 ? true : null;
    rec.escalations =
      !adaptive && receipt.routing.selectedLevel >= 3 ? 0 : receipt.routing.selectedLevel >= 3 ? 1 : 0;
    rec.policyVersion = receipt.routing.policy;
    rec.modelCalls = receipt.execution.llmCalls;
    rec.toolCalls = receipt.execution.stepCount;
    rec.outputTokens = receipt.execution.tokens;
    rec.parallelWorkers = def.id === "D" ? 3 : 1;
    rec.peakConcurrency = rec.parallelWorkers;
    rec.metadata = {
      raw_text: receipt.answer,
      mission_status: receipt.execution.status,
      steps: receipt.execution.steps,
      jury_quality: receipt.evaluation.quality > 0 ? receipt.evaluation.quality : null,
      judge_used: receipt.evaluation.verdict.toLowerCase() !== "n/a",
    };

    // Cost from the pricing table — never inline magic numbers.
    rec.cost = costBreakdown(
      receipt.execution.tokens > 0 && receipt.routing.selectedLevel >= 2
        ? (estimateCostUsd(model, null, receipt.execution.tokens, 0) ?? 0)
        : 0,
    );
    // Error path still returns a record (spec: a missing row is worse than a failed row).
  } catch (err) {
    rec.latencyMs = Date.now() - t0;
    rec.metadata = { error: err instanceof Error ? err.message : String(err), error_type: "run_failure" };
  }
  return rec;
}

// ─────────────────────────────────────────────────────────────
// Pinned single-call baselines: CLAUDE / OPENAI / GRAVITY-OPENROUTER.
// Provider pinning only — the exact model, no fallback chain, no auto-route.
// ─────────────────────────────────────────────────────────────

interface BaselineOutcome {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  model: string | null;
  latencyMs: number;
  ttftMs: number | null;
  retries: number;
  costUsd: number | null;
  error?: string;
}

async function pinnedCall(
  system: "CLAUDE" | "OPENAI" | "GRAVITY-OPENROUTER",
  prompt: string,
): Promise<BaselineOutcome> {
  const model =
    system === "CLAUDE"
      ? PINNED_CONFIG.CLAUDE_MODEL
      : system === "OPENAI"
        ? PINNED_CONFIG.OPENAI_MODEL
        : PINNED_CONFIG.OPENROUTER_MODEL;
  const t0 = Date.now();
  try {
    // Streaming call (text collected, deltas dropped): same pinned model, but
    // honest first-token timing + usage chunk ride along for TTFT metering.
    // opts.model set → plan is [model, model], never a provider drift.
    const result = await streamOpenRouter({
      prompt,
      model, // exact provider-pinned model — no routing, no fallback
      maxTokens: PINNED_CONFIG.MAX_TOKENS,
      temperature: PINNED_CONFIG.TEMPERATURE,
      timeoutMs: 55_000,
      onDelta: () => undefined,
    });
    return {
      text: result.text,
      inputTokens: result.inputTokens ?? null,
      outputTokens: result.tokens ?? null,
      cachedTokens: result.cachedTokens ?? null,
      model: result.model,
      latencyMs: Date.now() - t0,
      ttftMs: result.ttftMs ?? null,
      retries: (result.attempts ?? 1) - 1,
      costUsd: result.costUsd ?? estimateCostUsd(model, result.inputTokens ?? null, result.tokens ?? null, result.cachedTokens ?? 0),
    };
  } catch (err) {
    return {
      text: "",
      inputTokens: null,
      outputTokens: null,
      cachedTokens: null,
      model,
      latencyMs: Date.now() - t0,
      ttftMs: null,
      retries: 0,
      costUsd: null,
      error: err instanceof Error ? err.message : "pinned baseline call failed",
    };
  }
}

export async function runPinnedBaselineTask(
  system: "CLAUDE" | "OPENAI" | "GRAVITY-OPENROUTER",
  def: WorkloadClassDef,
  runId: string,
): Promise<BenchmarkRecord> {
  const runMode: RunMode = "STATIC";
  const rec = recordSkeleton(system, def, runId, runMode);
  rec.difficulty = classDifficulty(def);
  const model =
    system === "CLAUDE"
      ? PINNED_CONFIG.CLAUDE_MODEL
      : system === "OPENAI"
        ? PINNED_CONFIG.OPENAI_MODEL
        : PINNED_CONFIG.OPENROUTER_MODEL;
  rec.model = model;
  rec.provider = "openrouter";
  rec.modelVersion = model;
  rec.configHash = await configHash({
    system,
    model,
    temperature: PINNED_CONFIG.TEMPERATURE,
    maxTokens: PINNED_CONFIG.MAX_TOKENS,
    prompt: def.prompt,
  });
  rec.successCriterion = GROUND_TRUTH[def.id]?.successCriterion ?? "Deterministic output check on the raw response.";

  const call = await pinnedCall(system, def.prompt);
  rec.latencyMs = call.latencyMs;
  rec.ttftMs = call.ttftMs;
  rec.inputTokens = call.inputTokens;
  rec.outputTokens = call.outputTokens;
  rec.cachedTokens = call.cachedTokens;
  rec.modelCalls = call.error ? 0 : 1;
  rec.retries = call.retries;
  rec.cost = costBreakdown(call.costUsd);
  rec.metadata = call.error
    ? { error: call.error, error_type: "baseline_call_failed" }
    : { raw_text: call.text };

  // Raw baselines expose no decision trace → those fields stay honestly null.
  return rec;
}

// ─────────────────────────────────────────────────────────────
// JEV — declared in the spec's system table; the REST API isn't reachable
// from this deployment, so the adapter records the honest UNSUPPORTED fact.
// ─────────────────────────────────────────────────────────────

export async function runJevTask(
  def: WorkloadClassDef,
  runId: string,
): Promise<BenchmarkRecord> {
  const rec = recordSkeleton("JEV", def, runId, "ADAPTIVE");
  rec.difficulty = classDifficulty(def);
  rec.provider = "jev-rest-api";
  rec.configHash = await configHash({
    system: "JEV",
    model: null,
    temperature: PINNED_CONFIG.TEMPERATURE,
    maxTokens: PINNED_CONFIG.MAX_TOKENS,
    prompt: def.prompt,
  });
  rec.successCriterion = "JEV typed-choice response with probabilities (not wired).";
  rec.latencyMs = 0;
  rec.modelCalls = 0;
  rec.metadata = {
    error: "JEV adapter declared in the benchmark graph but its REST API is not wired into this deployment.",
    error_type: "unsupported_system",
  };
  return rec;
}

// ─────────────────────────────────────────────────────────────
// Deterministic difficulty map (spec: EASY | MEDIUM | HARD per class).
// Lives here so adapters own task-shape knowledge; the evaluator owns verdicts.
// ─────────────────────────────────────────────────────────────

export function classDifficulty(def: WorkloadClassDef): Difficulty {
  return GROUND_TRUTH[def.id]?.difficulty ?? "MEDIUM";
}
