/**
 * Bridge between Soham's pipeline (ProfileResult / CandidateScore shapes) and
 * the ported adaptive kernel (ProblemState -> allocation -> Thompson routing).
 *
 * `routeStrategyAdaptive` is a drop-in replacement for the old static
 * `routeStrategy`: same return shape, but the decision now comes from a
 * learning Thompson Sampling policy instead of a hand-tuned score table.
 */

import { profileProblemState, type ProblemStateProfile, type ProblemState } from "./problemState";
import { allocateIntelligence, strategyLevel, type EnterpriseContext } from "./allocation";
import type { StrategyKind, RiskLevel } from "./capabilities";
import {
  globalRoutingPolicy,
  routesFromAllocation,
  type AdaptiveRoutingDecision,
  type RouteCandidate,
  type RoutingOutcome,
} from "./routing";
import {
  modelCapabilityRegistry,
  capabilitiesForStrategy,
  requiredCapabilitiesForTask,
  type ModelCapability,
} from "./modelCapabilities";

export { profileProblemState } from "./problemState";
export { allocateIntelligence, strategyLevel } from "./allocation";
export { capabilityRegistry } from "./capabilities";
export { modelCapabilityRegistry, requiredCapabilitiesForTask } from "./modelCapabilities";
export {
  globalRoutingPolicy,
  routesFromAllocation,
  utilityFor,
  ThompsonSamplingPolicy,
} from "./routing";
export type { ProblemStateProfile, ProblemState } from "./problemState";
export type { IntelligenceAllocationPlan, EnterpriseContext } from "./allocation";
export type { StrategyKind, RiskLevel } from "./capabilities";
export type {
  AdaptiveRoutingDecision,
  RouteCandidate,
  RoutingOutcome,
  RoutingFeatures,
} from "./routing";

/** Mirror of pipeline.ts ProfileResult — kept local to avoid a circular import. */
interface BridgeProfile {
  dataType: string;
  complexity: "low" | "medium" | "high" | "critical";
  domain: string;
  signals: { name: string; value: number; unit?: string }[];
  dimensions: { name: string; score: number; maxScore: number }[];
  summary: string;
  wantsImage?: boolean;
  wantsWebsite?: boolean;
}

interface BridgeCandidate {
  strategy: StrategyKind;
  name: string;
  suitabilityScore: number;
  estimatedCost: number;
  estimatedLatencyMs: number;
  estimatedQuality: number;
  reasoning: string;
}

/**
 * Strategy catalog: expected quality / cost / latency priors per route.
 * Costs are 0 because the Gemini/Groq provider chain runs on free tiers;
 * the Thompson reward treats them as near-zero-cost routes.
 */
const STRATEGY_CATALOG: {
  strategy: StrategyKind;
  label: string;
  expectedQuality: number;
  estimatedCost: number;
  latencyMs: number;
  risk: RiskLevel;
}[] = [
  { strategy: "deterministic", label: "Deterministic Rules", expectedQuality: 40, estimatedCost: 0, latencyMs: 400, risk: "low" },
  { strategy: "statistical", label: "Statistical / ML", expectedQuality: 50, estimatedCost: 0, latencyMs: 8_000, risk: "low" },
  { strategy: "small_llm", label: "Compression + Small LLM", expectedQuality: 76, estimatedCost: 0, latencyMs: 12_000, risk: "low" },
  { strategy: "specialist_agent", label: "Specialist Agent", expectedQuality: 85, estimatedCost: 0, latencyMs: 20_000, risk: "medium" },
  { strategy: "advanced_reasoning", label: "Advanced Reasoning", expectedQuality: 86, estimatedCost: 0, latencyMs: 26_000, risk: "medium" },
  { strategy: "multi_agent", label: "Multi-Agent Deliberation", expectedQuality: 92, estimatedCost: 0, latencyMs: 32_000, risk: "medium" },
  { strategy: "image_generation", label: "Image Generation", expectedQuality: 90, estimatedCost: 0, latencyMs: 8_000, risk: "low" },
  { strategy: "website_builder", label: "Website Builder", expectedQuality: 88, estimatedCost: 0, latencyMs: 15_000, risk: "low" },
];

/** Complexity heuristic keeps the Thompson context grounded in his 4-band scale. */
const COMPLEXITY_TO_SCORE: Record<BridgeProfile["complexity"], number> = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 92,
};

const MAP_DATA_TYPE: Record<string, string> = {
  structured: "structured",
  text: "text",
  documents: "documents",
  images: "images",
  time_series: "time_series",
  mixed: "mixed",
  unknown: "unknown",
};

export interface AdaptiveRouteResult {
  candidates: BridgeCandidate[];
  selected: BridgeCandidate;
  escalationLevel: number;
  voiScore: number;
  confidence: number;
  reasoning: string;
  /** Kernel internals — persisted to the routing decision for transparency. */
  kernel: {
    problemState: ProblemStateProfile;
    allocation: ReturnType<typeof allocateIntelligence>;
    decision: AdaptiveRoutingDecision;
  };
}

function candidateFor(route: RouteCandidate): BridgeCandidate {
  return {
    strategy: route.strategy,
    name: route.modelOrAlgorithm,
    suitabilityScore: Math.round(route.estimatedQuality),
    estimatedCost: route.estimatedCost,
    estimatedLatencyMs: route.estimatedLatencyMs,
    estimatedQuality: route.estimatedQuality,
    reasoning: `${route.modelOrAlgorithm}: expected quality ${Math.round(route.estimatedQuality)}%, ~${Math.round(route.estimatedLatencyMs / 1000)}s, ${route.risk} risk. Sampled by the Thompson policy under the current Problem State.`,
  };
}

/**
 * The adaptive brain. Builds a Problem State from the heuristic profile,
 * discovers capabilities, constructs route candidates, and lets the
 * Thompson Sampling policy pick the winner.
 */
export function routeStrategyAdaptive(
  profile: BridgeProfile,
  rawPrompt?: string,
  enterpriseContext: EnterpriseContext = {},
): AdaptiveRouteResult {
  // 1. Deep Problem State — deterministic, zero tokens. The RAW prompt drives
  //    keyword profiling; his structured summary would defeat the detectors.
  const problemState = profileProblemState({
    task: rawPrompt?.trim() || profile.summary,
    context: { domain: profile.domain, complexityBand: profile.complexity },
  });

  // Enrich the deterministic state with what his profiler measured.
  problemState.problemState.data.type = MAP_DATA_TYPE[profile.dataType] ?? "unknown";
  problemState.problemState.complexity.task = COMPLEXITY_TO_SCORE[profile.complexity];
  problemState.problemState.complexity.computationalEstimate = Math.min(
    100,
    COMPLEXITY_TO_SCORE[profile.complexity] + (profile.complexity === "critical" ? 15 : 0),
  );
  problemState.stateVector.complexity = problemState.problemState.complexity.task;
  problemState.stateVector.dataState = problemState.problemState.data.type;

  // Creative intents route through their dedicated capabilities.
  if (profile.wantsImage) problemState.problemState.intent.taskType = "creation";
  if (profile.wantsWebsite) problemState.problemState.intent.taskType = "creation";

  // Creative intents steer capability discovery to the dedicated capability.
  const approvedCapabilities: string[] | null =
    profile.wantsImage && !profile.wantsWebsite
      ? ["enterprise.visual-generation"]
      : profile.wantsWebsite && !profile.wantsImage
        ? ["enterprise.web-artifact"]
        : null;

  // 2. Capability discovery + policy filtering.
  const allocation = allocateIntelligence(problemState, { ...enterpriseContext, approvedCapabilities });

  // No human workers exist in this deployment: degrade human_review to the
  // highest autonomous method so high-consequence capabilities stay usable.
  if (allocation.selectedStrategy === "human_review") {
    const autonomous = allocation.candidateStrategies.filter((method) => method !== "human_review");
    allocation.selectedStrategy = autonomous[autonomous.length - 1] ?? "multi_agent";
    allocation.escalationLevel = strategyLevel(allocation.selectedStrategy);
    allocation.executionMode = "cloud";
    allocation.rationale.push(
      "No human-review workers registered in this deployment; degraded to the highest autonomous method.",
    );
  }

  // 3. MODEL CAPABILITY ELIGIBILITY CHECK (before optimization).
  //    The senior's principle: capability eligibility must happen BEFORE
  //    optimization. A cheap text model cannot be selected for image generation
  //    just because its expected utility is attractive.
  //
  //    Determine which model capabilities this task requires, then filter the
  //    strategy catalog to only strategies that have at least one eligible model.
  const requiredModelCaps = requiredCapabilitiesForTask(
    problemState.problemState.intent.taskType,
    profile.wantsImage ?? false,
    profile.wantsWebsite ?? false,
  );
  const eligibleStrategies = STRATEGY_CATALOG.filter((entry) => {
    const neededCaps = capabilitiesForStrategy(entry.strategy);
    const eligibleModels = modelCapabilityRegistry.eligible(neededCaps);
    return eligibleModels.some((m) => m.available);
  });

  // 4. Candidate routes from the allocated capability's supported methods.
  //    Quality priors are context-aware: the least complex route WINS its prior
  //    when the problem is fully specified for it (least-complex-sufficient).
  const numericState =
    problemState.problemState.data.type === "structured" ||
    problemState.problemState.data.type === "time_series";
  const lowComplexity = problemState.problemState.complexity.task <= 40;
  const isTemporal = problemState.problemState.data.type === "time_series";
  const catalog = STRATEGY_CATALOG.map((entry) => {
    if (
      entry.strategy === "deterministic" &&
      numericState &&
      lowComplexity &&
      problemState.problemState.intent.taskType === "calculation"
    )
      return { ...entry, expectedQuality: 96 };
    if (entry.strategy === "statistical" && isTemporal) return { ...entry, expectedQuality: 84 };
    return entry;
  });
  // Filter catalog to only strategies with eligible models (capability check).
  const eligibleCatalog = catalog.filter((entry) =>
    eligibleStrategies.some((es) => es.strategy === entry.strategy),
  );
  const routes = routesFromAllocation(allocation, eligibleCatalog);
  const fallbackRoutes: RouteCandidate[] = routes.length
    ? routes
    : [
        {
          routeId: "fallback:small_llm",
          capabilityId: "fallback",
          capability: "Fallback",
          intelligenceLevel: 2,
          strategy: "small_llm",
          modelOrAlgorithm: "Compression + Small LLM",
          executionMode: "cloud",
          resource: "gpu",
          configuration: {},
          estimatedCost: 0,
          estimatedLatencyMs: 12_000,
          estimatedQuality: 76,
          risk: "low",
          source: "allocation",
        },
      ];

  // 5. Thompson Sampling picks the winner (learning policy, process-wide).
  //    Optimization happens ONLY after capability eligibility is established.
  //    The bandit selects within the eligible set — never outside it.
  //    Decomposable multi-part analysis is pinned to deliberation (parallel
  //    specialists + synthesis); a cold-start bandit must not miss this shape.
  const parallelIntent =
    /\b(three|3)\b.{0,40}\bworkstreams?\b|\b(each|all)\s+(of\s+)?(three|3)\b/i.test(
      rawPrompt ?? "",
    );
  const sampled = globalRoutingPolicy.selectRoute(problemState.problemState, fallbackRoutes);
  const parallelPin = parallelIntent
    ? fallbackRoutes.find((route) => route.strategy === "multi_agent")
    : null;

  // Structurally verified shapes are pinned too: the deep profiler has
  // deterministic ground truth for exact computation and spike detection,
  // so a noisy cold-start sample must not gamble them away.
  const structuralPin =
    problemState.problemState.intent.taskType === "calculation" &&
    numericState &&
    lowComplexity
      ? fallbackRoutes.find((route) => route.strategy === "deterministic")
      : problemState.problemState.intent.taskType === "analysis" && isTemporal
        ? fallbackRoutes.find((route) => route.strategy === "statistical")
        : null;

  // Hard creative intents are pinned by policy — a cold-start bandit must not
  // gamble an image request on a text route. The bandit owns the L2-L5 ladder.
  const pinned =
    profile.wantsImage && !profile.wantsWebsite
      ? fallbackRoutes.find((route) => route.strategy === "image_generation")
      : profile.wantsWebsite && !profile.wantsImage
        ? fallbackRoutes.find((route) => route.strategy === "website_builder")
        : null;
  const policyPin = pinned ?? parallelPin ?? structuralPin ?? null;
  const pinReason = pinned
    ? "Hard creative intent pinned to its dedicated route by policy; the bandit owns the model ladder."
    : parallelPin
      ? "Parallel multi-workstream intent pinned to multi-agent deliberation."
      : structuralPin
        ? "Fully specified computation/statistics pinned to the least complex sufficient level; the bandit owns the ambiguous ladder."
        : null;
  const decision =
    policyPin && policyPin.routeId !== sampled.selectedRoute.routeId
      ? {
          ...sampled,
          selectedRoute: policyPin,
          runnerUp: sampled.selectedRoute,
          rationale: [...sampled.rationale, pinReason!],
        }
      : sampled;

  const candidates = decision.candidateRoutes.map(candidateFor);
  const selected = candidateFor(decision.selectedRoute);
  const runnerUp = decision.runnerUp;
  const voiScore = runnerUp
    ? Number(
        (
          (decision.selectedRoute.estimatedQuality - runnerUp.estimatedQuality) /
          Math.max(decision.selectedRoute.estimatedLatencyMs / 1000, 0.4)
        ).toFixed(3),
      )
    : 0.9;

  const reasoning =
    `${selected.name} selected by ${decision.policyName} (${decision.explorationState}, ` +
    `${decision.mode}; confidence ${decision.confidence}%). ` +
    (runnerUp
      ? `${runnerUp.modelOrAlgorithm} rejected: lower sampled utility under the current Problem State. `
      : "") +
    `Capability: ${allocation.selectedCapability ?? "fallback"} — ${allocation.rationale[0] ?? ""}`;

  return {
    candidates,
    selected,
    escalationLevel: strategyLevel(selected.strategy),
    voiScore,
    confidence: decision.confidence / 100,
    reasoning,
    kernel: { problemState, allocation, decision },
  };
}

/**
 * Learning loop entry point. After a mission finishes, feed the outcome back
 * so the Thompson posteriors update and the next routing decision improves.
 */
export function recordRouteOutcome(
  result: AdaptiveRouteResult,
  outcome: {
    status: RoutingOutcome["status"];
    quality: number;
    latencyMs: number;
    tokens: number;
  },
): void {
  const { kernel } = result;
  const features = kernel.decision.features;
  const reliability = outcome.status === "SUCCESS" ? 95 : outcome.status === "FAILED" ? 30 : 60;
  globalRoutingPolicy.update(
    kernel.decision.selectedRoute,
    {
      status: outcome.status,
      quality: outcome.quality,
      reliability,
      latencyMs: outcome.latencyMs,
      cost: 0,
      risk: kernel.decision.selectedRoute.risk,
    },
    features,
  );
}

export interface PersistedAdaptiveDecision {
  routeId: string;
  capabilityId: string;
  strategy: StrategyKind;
  modelOrAlgorithm: string;
  intelligenceLevel: number;
  estimatedCost: number;
  estimatedLatencyMs: number;
  estimatedQuality: number;
  risk: RiskLevel;
  policyName: string;
  policyVersion: string;
  explorationState: string;
  mode: string;
  confidence: number;
  featureNames: string[];
  featureValues: number[];
  runnerUp: string | null;
  adaptation: { regimeShift: boolean; explorationBoost: number; observations: number };
}

/** Serialize the kernel decision so the learning loop can run from the DB row. */
export function toPersistedAdaptive(result: AdaptiveRouteResult): PersistedAdaptiveDecision {
  const { decision } = result.kernel;
  return {
    routeId: decision.selectedRoute.routeId,
    capabilityId: decision.selectedRoute.capabilityId,
    strategy: decision.selectedRoute.strategy,
    modelOrAlgorithm: decision.selectedRoute.modelOrAlgorithm,
    intelligenceLevel: decision.selectedRoute.intelligenceLevel,
    estimatedCost: decision.selectedRoute.estimatedCost,
    estimatedLatencyMs: decision.selectedRoute.estimatedLatencyMs,
    estimatedQuality: decision.selectedRoute.estimatedQuality,
    risk: decision.selectedRoute.risk,
    policyName: decision.policyName,
    policyVersion: decision.policyVersion,
    explorationState: decision.explorationState,
    mode: decision.mode,
    confidence: decision.confidence,
    featureNames: decision.features.names,
    featureValues: decision.features.values,
    runnerUp: decision.runnerUp?.modelOrAlgorithm ?? null,
    adaptation: globalRoutingPolicy.getAdaptationState(),
  };
}

/** Reconstruct a route candidate from its persisted form. */
function routeFromPersisted(persisted: PersistedAdaptiveDecision): RouteCandidate {
  return {
    routeId: persisted.routeId,
    capabilityId: persisted.capabilityId,
    capability: persisted.capabilityId,
    intelligenceLevel: persisted.intelligenceLevel,
    strategy: persisted.strategy,
    modelOrAlgorithm: persisted.modelOrAlgorithm,
    executionMode:
      persisted.strategy === "human_review"
        ? "human"
        : persisted.strategy === "deterministic" || persisted.strategy === "statistical"
          ? "local"
          : "cloud",
    resource:
      persisted.strategy === "human_review"
        ? "human"
        : persisted.strategy === "deterministic" || persisted.strategy === "statistical"
          ? "cpu"
          : "gpu",
    configuration: {},
    estimatedCost: persisted.estimatedCost,
    estimatedLatencyMs: persisted.estimatedLatencyMs,
    estimatedQuality: persisted.estimatedQuality,
    risk: persisted.risk,
    source: "allocation",
  };
}

/**
 * Learning loop from the persisted decision (used by executeMission, which
 * only has the DB routing row — not the in-memory kernel object).
 */
export function recordPersistedOutcome(
  persisted: PersistedAdaptiveDecision,
  outcome: { status: RoutingOutcome["status"]; quality: number; latencyMs: number },
): void {
  const reliability = outcome.status === "SUCCESS" ? 95 : outcome.status === "FAILED" ? 30 : 60;
  globalRoutingPolicy.update(
    routeFromPersisted(persisted),
    {
      status: outcome.status,
      quality: outcome.quality,
      reliability,
      latencyMs: outcome.latencyMs,
      cost: persisted.estimatedCost,
      risk: persisted.risk,
    },
    { names: persisted.featureNames, values: persisted.featureValues },
  );
}

/** Adaptation telemetry for receipts / UI. */
export function adaptationState() {
  return globalRoutingPolicy.getAdaptationState();
}
