/**
 * Five Workload Classes — ported from the intelligence-fabric battery.
 * Runs real missions through the live pipeline (driven by the adaptive kernel)
 * and judges the STRUCTURAL behavior, not just the answer text: the right
 * level, the right tokens, the right adaptation.
 */

import { getMission, getExecutionRuns, getExecutionNodes, getEvaluation, getRoutingDecision } from "@/lib/db-firestore";
import { createMissionWithPlan, executeMission } from "./pipeline";
import { adaptationState } from "./kernel";

export type WorkloadClassId = "A" | "B" | "C" | "D" | "E";

export interface WorkloadClassDef {
  id: WorkloadClassId;
  title: string;
  examples: string;
  claim: string;
  prompt: string;
  expect: {
    levels: number[];
    shape: "deterministic" | "statistical" | "model" | "parallel" | "resilient";
    liveModel: boolean;
  };
}

export const WORKLOAD_CLASSES: WorkloadClassDef[] = [
  {
    id: "A",
    title: "Fully specified computation",
    examples: "sales math · unit aggregation · exact answers at Level 0",
    claim:
      "Structured numeric tasks are computed locally at Level 0 — zero model tokens, exact answer.",
    prompt:
      "Calculate the total revenue for the year: Q1 sales were 220 units at $410 each, Q2 sales were 310 units at $425 each. Use the database figures and calculate the exact total revenue.",
    expect: { levels: [0], shape: "deterministic", liveModel: false },
  },
  {
    id: "B",
    title: "Statistical anomaly detection",
    examples: "z-score spikes · trend drift · local computation",
    claim:
      "Time-series structure routes to the statistical engine — computed, not hallucinated.",
    prompt:
      "Analyze this historical monthly time series for anomalies: 340, 355, 362, 348, 371, 489, 366, 359, 374, 368, 380, 372 kWh. Identify any monthly spike and the overall trend.",
    expect: { levels: [0, 1], shape: "statistical", liveModel: false },
  },
  {
    id: "C",
    title: "Open-ended synthesis",
    examples: "strategy briefs · nuanced analysis · model escalation",
    claim:
      "Ambiguous, open-ended work escalates to the model ladder with a real token receipt.",
    prompt:
      "We are debating two product strategies. Option A: deepen the analytics platform for enterprise compliance buyers, slower sales cycles, higher contract values. Option B: ship a self-serve lightweight tier for startups, fast adoption, thinner margins. Recommend one, defend it with trade-offs, and define what evidence would change your mind.",
    expect: { levels: [2, 3, 4, 5], shape: "model", liveModel: true },
  },
  {
    id: "D",
    title: "Parallel multi-step analysis",
    examples: "independent workstreams · parallel specialists · synthesis",
    claim:
      "Decomposable work executes as parallel independent steps, then synthesizes.",
    prompt:
      "Analyze our expansion decision across three workstreams: (1) the financial case for expanding to two new cities, (2) the operational risks of scaling delivery logistics, (3) the competitive landscape response. Provide an integrated recommendation after comparing all three analyses.",
    expect: { levels: [5], shape: "parallel", liveModel: false },
  },
  {
    id: "E",
    title: "Graceful degradation",
    examples: "worker failure · retry · recovery",
    claim:
      "A resource failure mid-run is absorbed by the orchestrator: retry succeeds, mission completes.",
    prompt:
      "Summarize the key operational risks in our delivery pipeline and recommend mitigations for the next quarter.",
    expect: { levels: [2, 3, 4, 5], shape: "resilient", liveModel: false },
  },
];

export interface ClassReceipt {
  classId: WorkloadClassId;
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

interface NodeDoc {
  id: string;
  name: string;
  stage: string | null;
  status: string;
  tokens: number;
  output: string | null;
}

async function fetchMissionState(missionId: string) {
  const [mission, run, nodes, evaluation] = await Promise.all([
    getMission(missionId),
    getExecutionRuns(missionId),
    (async () => {
      const runs = await getExecutionRuns(missionId);
      return runs[0] ? await getExecutionNodes(runs[0].id) : [];
    })(),
    getEvaluation(missionId),
  ]);
  const runRow = run[0] ?? null;
  void mission;
  return { runRow, nodes: (nodes ?? []) as NodeDoc[], evaluation };
}

export async function runWorkloadClass(
  def: WorkloadClassDef,
  options: { routing?: "adaptive" | "static" } = {},
): Promise<ClassReceipt> {
  const started = Date.now();

  // 1. Profile + route (the adaptive kernel decides inside createMissionWithPlan;
  //    routing:"static" pins the legacy heuristic router for the benchmark baseline).
  const { mission } = await createMissionWithPlan(def.prompt, {
    tenantId: "workload-battery",
    userId: "workload-battery",
    routing: options.routing,
  });

  // 2. Read back the persisted kernel decision.
  const decision = await getRoutingDecision(mission.id);
  const adaptive = (decision?.adaptive ?? null) as {
    modelOrAlgorithm: string;
    intelligenceLevel: number;
    policyName: string;
    explorationState: string;
    mode: string;
    confidence: number;
    rationale: string[];
    runnerUp: string | null;
    adaptation: { regimeShift: boolean; explorationBoost: number; observations: number };
  } | null;

  const selectedLevel = decision?.escalationLevel ?? 0;
  const structuralPass = def.expect.levels.includes(selectedLevel);

  // 3. Execute. Class E arms a one-shot worker failure right before the run
  //    (after profiling, so the orchestrator's retry story is the one shown).
  let executionError: string | null = null;
  const armE = def.id === "E";
  if (armE) {
    let consumed = false;
    (globalThis as unknown as { __gravity_inject_failure__?: unknown }).__gravity_inject_failure__ = {
      consume: () => {
        if (!consumed) {
          consumed = true;
          return true;
        }
        return false;
      },
    };
  }
  try {
    await executeMission(mission.id);
  } catch (err) {
    executionError = err instanceof Error ? err.message : String(err);
  } finally {
    if (armE) (globalThis as unknown as { __gravity_inject_failure__?: unknown }).__gravity_inject_failure__ = undefined;
  }

  // 4. Pull the real execution state back from the DB.
  const { runRow, nodes, evaluation } = await fetchMissionState(mission.id);
  const totalTokens = nodes.reduce((sum, node) => sum + (node.tokens ?? 0), 0);
  const llmCalls = nodes.filter((node) => (node.tokens ?? 0) > 0).length;
  const lastOutput = [...nodes].reverse().find((node) => (node.output ?? "").length > 0)?.output ?? "";

  // 5. Deterministic answer checks for the zero-token classes.
  let answerPass = true;
  let answerNote = "";
  if (def.id === "A" && selectedLevel === 0) {
    answerPass = /221,950|221950/.test(lastOutput);
    answerNote = answerPass ? "exact local math verified ($221,950)" : "local math answer missing or wrong";
  }
  if (def.id === "B" && selectedLevel <= 1) {
    answerPass = /489/.test(lastOutput);
    answerNote = answerPass ? "injected spike (489 kWh) surfaced by local stats" : "spike value missing from output";
  }

  // 6. Verdict.
  const status: "PASS" | "FAIL" =
    structuralPass && answerPass && !executionError ? "PASS" : "FAIL";
  const reasons: string[] = [];
  if (!structuralPass)
    reasons.push(`expected level ${def.expect.levels.join("|")}, got ${selectedLevel}`);
  if (!answerPass) reasons.push(answerNote || "answer check failed");
  if (executionError) reasons.push(`execution failed: ${executionError.slice(0, 140)}`);

  return {
    classId: def.id,
    status,
    verdict:
      status === "PASS"
        ? `Level ${selectedLevel} · ${adaptive?.modelOrAlgorithm ?? decision?.selectedStrategy} · ${def.expect.shape} shape${answerNote ? ` · ${answerNote}` : ""}`
        : `FAIL: ${reasons.join("; ")}`,
    missionId: mission.id,
    durationMs: Date.now() - started,
    routing: {
      selectedLabel: adaptive?.modelOrAlgorithm ?? decision?.selectedStrategy ?? "unknown",
      selectedLevel,
      policy: adaptive?.policyName ?? "legacy-static",
      explorationState: adaptive?.explorationState ?? "unknown",
      mode: adaptive?.mode ?? "unknown",
      confidence: decision?.confidence ?? 0,
      rationale: adaptive?.rationale ?? [],
    },
    execution: {
      status: runRow?.status ?? (executionError ? "failed" : "unknown"),
      tokens: totalTokens,
      llmCalls,
      stepCount: nodes.length,
      steps: nodes.map((node) => ({
        name: node.name,
        stage: node.stage,
        status: node.status,
        tokens: node.tokens ?? 0,
      })),
    },
    evaluation: {
      verdict: evaluation?.outputVerdict ?? "n/a",
      quality: evaluation?.qualityScore ?? 0,
      judgeUsed: Boolean(evaluation?.feedback?.includes("graded by model jury")),
    },
    answer: lastOutput.slice(0, 4000),
    adaptation: adaptive?.adaptation ?? adaptationState(),
  };
}
