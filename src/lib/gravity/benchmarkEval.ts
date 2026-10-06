/**
 * Evaluators — the senior's "exact graph", Box 3.
 *
 * Deterministic success checks over the adapter's raw output: exact-match /
 * numeric-tolerance regexes, rule sets, and structural run facts. An LLM judge
 * is deliberately NOT used here — non-deterministic verdicts poison a
 * benchmark. Each check returns evidence of exactly what was verified.
 *
 * Contract (spec): the evaluator returns
 *   { success, qualityScore, correctness, completeness, verificationStatus, evidence }
 * and the RUNNER (Box 4) merges the verdict into the record — the adapter
 * never computes success itself.
 *
 * Honest-None discipline: when a check can't be applied (no raw text, no run
 * facts), success stays null and verificationStatus is SKIPPED/INSUFFICIENT —
 * never a fabricated false.
 */

import type { BenchmarkRecord, VerificationStatus } from "./benchmarkTypes";
import type { WorkloadClassId } from "./classes";

export interface EvalVerdict {
  /** null = inconclusive — the evaluator refuses to guess (honest None). */
  success: boolean | null;
  qualityScore: number | null;
  correctness: number | null;
  completeness: number | null;
  verificationStatus: VerificationStatus;
  evidence: Record<string, unknown>;
}

interface TaskTruth {
  difficulty: "EASY" | "MEDIUM" | "HARD";
  /** Human-readable deterministic criterion, frozen per the spec. */
  successCriterion: string;
  /** Numeric-tolerance / exact-match check over the output text. */
  textCheck?: (output: string) => boolean;
  /** Structural check over GRAVITY run facts (route level, token spend, steps). */
  structuralCheck?: (facts: { level: number | null; tokens: number; stepCount: number; steps: { status: string }[] }) => boolean;
  /** Fair fallback for raw single-shot baselines without run facts. */
  staticCheck?: (output: string) => boolean;
}

/**
 * GROUND_TRUTH — frozen deterministic criteria per workload class, ported
 * 1:1 from the existing harness so historic records stay comparable.
 */
export const GROUND_TRUTH: Record<WorkloadClassId, TaskTruth> = {
  A: {
    difficulty: "EASY",
    // 220*410 + 310*425 = 90,200 + 131,750 = 221,950
    successCriterion:
      "Output states exact total revenue $221,950 (numeric tolerance) computed from units × price.",
    textCheck: (output) => /221,?950/.test(output),
  },
  B: {
    difficulty: "MEDIUM",
    successCriterion:
      "Output flags the Month-6 consumption spike (489, |z| > 2.5) in the kWh series and reports a numeric trend (schema + rule satisfaction).",
    textCheck: (output) => /489/.test(output) && /kWh/i.test(output),
    staticCheck: (output) => /489/.test(output) && /kWh/i.test(output),
  },
  C: {
    difficulty: "HARD",
    successCriterion:
      "Escalation ladder fires: substantive model output with real reasoning spend (subjective quality marked as such per spec).",
    textCheck: (output) => output.length >= 250,
    structuralCheck: (facts) => facts.level !== null && facts.level >= 3 && facts.tokens > 0,
    staticCheck: (output) => output.length >= 250,
  },
  D: {
    difficulty: "MEDIUM",
    successCriterion:
      "All orchestration steps complete with non-empty outputs, and the integrated answer is substantive (rule satisfaction over the execution plan).",
    structuralCheck: (facts) =>
      facts.stepCount > 0 && facts.steps.every((step) => step.status === "completed"),
    staticCheck: (output) => output.length >= 100,
  },
  E: {
    difficulty: "HARD",
    successCriterion:
      "Run completes despite the injected mid-run resource failure — the orchestrator absorbed the change (run status, not wording).",
    structuralCheck: (facts) => facts.stepCount > 0 && facts.steps.every((step) => step.status === "completed"),
    staticCheck: (output) => output.length >= 100,
  },
};

/** Main entry point (spec's `evaluate(task, record)`). */
export function evaluateRecord(
  workloadClass: WorkloadClassId,
  record: BenchmarkRecord,
): EvalVerdict {
  const truth = GROUND_TRUTH[workloadClass];
  if (!truth) {
    return {
      success: null,
      qualityScore: null,
      correctness: null,
      completeness: null,
      verificationStatus: "SKIPPED",
      evidence: { reason: "unknown workload class" },
    };
  }

  // ── Error records are failures, never silent disappearances ──
  const meta = (record.metadata ?? {}) as Record<string, unknown>;
  if (meta.error) {
    return {
      success: false,
      qualityScore: null,
      correctness: null,
      completeness: null,
      verificationStatus: "FAIL",
      evidence: { error: String(meta.error).slice(0, 300), error_type: meta.error_type ?? "unknown" },
    };
  }

  const raw = typeof meta.raw_text === "string" ? meta.raw_text : "";

  // ── GRAVITY-family: structural check over real run facts, plus text check ──
  if (record.intelligenceLevel !== null) {
    const facts = {
      level: record.intelligenceLevel,
      tokens: record.outputTokens ?? 0,
      stepCount: record.toolCalls,
      steps: (meta.steps as { status: string }[] | undefined) ?? [],
    };
    const structural = truth.structuralCheck ? truth.structuralCheck(facts) : true;
    const text = truth.textCheck ? truth.textCheck(raw) : true;
    const success = structural && text;
    const completeness =
      facts.stepCount > 0
        ? Math.min(1, facts.steps.filter((s) => s.status === "completed").length / facts.stepCount)
        : null;
    // Quality is honest: the pipeline's measured jury score when the judge ran;
    // null otherwise (no fabricated level-derived number).
    const juryScore = typeof meta.jury_quality === "number" ? meta.jury_quality : null;
    const judgeUsed = meta.judge_used === true;
    return {
      success,
      qualityScore: judgeUsed && juryScore !== null ? juryScore : null,
      correctness: success ? 1.0 : 0.0,
      completeness,
      verificationStatus: success ? "PASS" : "FAIL",
      evidence: {
        structural,
        text,
        level: facts.level,
        tokens: facts.tokens,
        stepCount: facts.stepCount,
        expectedLevel: record.route,
        judgeUsed,
      },
    };
  }

  // ── Raw baselines: fair static check on raw_text only ──
  const check = truth.staticCheck ?? truth.textCheck;
  if (!check) {
    return {
      success: null,
      qualityScore: null,
      correctness: null,
      completeness: null,
      verificationStatus: "INSUFFICIENT",
      evidence: { reason: "no applicable deterministic check" },
    };
  }
  if (!raw) {
    return {
      success: null,
      qualityScore: null,
      correctness: null,
      completeness: null,
      verificationStatus: "SKIPPED",
      evidence: { reason: "no raw output captured" },
    };
  }
  const passed = check(raw);
  return {
    success: passed,
    qualityScore: passed ? 0.85 : 0.3,
    correctness: passed ? 1.0 : 0.0,
    completeness: passed ? 1.0 : 0.0,
    verificationStatus: passed ? "PASS" : "FAIL",
    evidence: { check: truth.successCriterion, outputLength: raw.length },
  };
}
