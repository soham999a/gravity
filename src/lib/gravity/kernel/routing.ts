import type { ProblemStateProfile } from "./problemState";
import type { IntelligenceAllocationPlan } from "./allocation";
import type { RiskLevel, StrategyKind } from "./capabilities";

// ---------------------------------------------------------------------------
// Reward function (ported utilityFor): scores a route/outcome pair.
// ---------------------------------------------------------------------------

export interface UtilityConfig {
  qualityWeight: number;
  reliabilityWeight: number;
  costPenalty: number;
  latencyPenalty: number;
  riskPenalty: number;
  maxCost?: number;
  maxLatencyMs?: number;
}

export const DEFAULT_UTILITY: UtilityConfig = {
  qualityWeight: 0.62,
  reliabilityWeight: 0.28,
  costPenalty: 0.06,
  latencyPenalty: 0.04,
  riskPenalty: 0.12,
};

export interface RoutingOutcome {
  status: "SUCCESS" | "INSUFFICIENT" | "FAILED" | "UNCERTAIN" | "ESCALATE" | "REROUTE";
  quality: number;
  reliability: number;
  latencyMs: number;
  cost: number;
  risk?: RiskLevel;
  note?: string;
}

export interface RouteCandidate {
  routeId: string;
  capabilityId: string;
  capability: string;
  intelligenceLevel: number;
  strategy: StrategyKind;
  modelOrAlgorithm: string;
  executionMode: "local" | "cloud" | "distributed" | "human";
  resource: "cpu" | "gpu" | "distributed" | "human";
  configuration: Record<string, string | number | boolean>;
  estimatedCost: number;
  estimatedLatencyMs: number;
  estimatedQuality: number;
  risk: RiskLevel;
  source: "enterprise-registry" | "allocation";
}

export function utilityFor(
  route: RouteCandidate,
  outcome: Partial<RoutingOutcome> = {},
  config: UtilityConfig = DEFAULT_UTILITY,
): number {
  const quality = (outcome.quality ?? route.estimatedQuality) / 100;
  const reliability = (outcome.reliability ?? 80) / 100;
  const cost = outcome.cost ?? route.estimatedCost;
  const latency = outcome.latencyMs ?? route.estimatedLatencyMs;
  const risk: Record<RiskLevel, number> = { low: 0, medium: 0.5, high: 1 };
  const costTerm = Math.min(cost, 100) / 100;
  const latencyTerm = Math.min(latency, 86_400_000) / 86_400_000;
  return Number(
    (
      config.qualityWeight * quality +
      config.reliabilityWeight * reliability -
      config.costPenalty * costTerm -
      config.latencyPenalty * latencyTerm -
      config.riskPenalty * risk[outcome.risk ?? route.risk]
    ).toFixed(6),
  );
}

// ---------------------------------------------------------------------------
// Context features: what the router knows about the problem + route.
// ---------------------------------------------------------------------------

export interface RoutingFeatures {
  names: string[];
  values: number[];
}

const riskNumber: Record<RiskLevel, number> = { low: 0, medium: 0.5, high: 1 };

export function buildRoutingFeatures(
  state: ProblemStateProfile["problemState"],
  route: RouteCandidate,
): RoutingFeatures {
  const context: [string, number][] = [
    ["bias", 1],
    ["task_complexity", state.complexity.task / 100],
    ["reasoning_complexity", state.complexity.reasoning / 100],
    ["uncertainty", state.uncertainty.outcome / 100],
    ["ambiguity", state.uncertainty.ambiguity / 100],
    ["risk", riskNumber[state.risk.level]],
    ["quality_requirement", (state.quality.requiredAccuracy ?? 70) / 100],
    ["temporal_data", state.data.type === "time_series" ? 1 : 0],
    ["semantic_data", state.data.structure === "unstructured" ? 1 : 0],
  ];
  const action: [string, number][] = [
    ["route_level", route.intelligenceLevel / 6],
    ["route_quality", route.estimatedQuality / 100],
    ["route_cost", Math.min(route.estimatedCost, 100) / 100],
    ["route_latency", Math.min(route.estimatedLatencyMs, 86_400_000) / 86_400_000],
    ["route_risk", riskNumber[route.risk]],
  ];
  return {
    names: [
      ...context.map(([name]) => name),
      ...action.map(([name]) => name),
      "complexity_x_level",
      "uncertainty_x_level",
    ],
    values: [
      ...context.map(([, value]) => value),
      ...action.map(([, value]) => value),
      (state.complexity.task / 100) * (route.intelligenceLevel / 6),
      (state.uncertainty.outcome / 100) * (route.intelligenceLevel / 6),
    ],
  };
}

// ---------------------------------------------------------------------------
// Contextual Thompson Sampling policy with regime-shift adaptation.
// ---------------------------------------------------------------------------

interface Posterior {
  mean: number[];
  precision: number[];
  observations: number;
}

export interface AdaptiveRoutingDecision {
  policyName: string;
  policyVersion: string;
  explorationState: "cold_start" | "steady_state" | "regime_shift";
  mode: "exploration" | "exploitation";
  confidence: number;
  explorationBoost: number;
  selectedRoute: RouteCandidate;
  candidateRoutes: RouteCandidate[];
  runnerUp: RouteCandidate | null;
  features: RoutingFeatures;
  estimatedUtility: number;
  rationale: string[];
  timestamp: string;
}

export type RoutingMode = "exploration" | "exploitation";

export class ThompsonSamplingPolicy {
  readonly name = "contextual-thompson-sampling";
  readonly version = "0.1.0";
  private readonly posteriors = new Map<string, Posterior>();
  private readonly recentRewards: number[] = [];
  private explorationBoost = 0;
  private regimeShift = false;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  selectRoute(
    state: ProblemStateProfile["problemState"],
    candidates: RouteCandidate[],
  ): AdaptiveRoutingDecision {
    if (candidates.length === 0)
      throw new Error("Routing requires at least one eligible candidate");
    const scored = candidates.map((route) => {
      const features = buildRoutingFeatures(state, route);
      const posterior = this.posteriorFor(route.routeId, features.values.length);
      const sampledWeights = posterior.mean.map(
        (mean, index) => mean + this.normalSample() / Math.sqrt(posterior.precision[index]),
      );
      const sampledUtility = sampledWeights.reduce(
        (sum, weight, index) => sum + weight * features.values[index],
        0,
      );
      const priorUtility = utilityFor(route);
      const score =
        0.72 * sampledUtility + 0.28 * priorUtility + this.explorationBoost * this.random();
      return { route, features, posterior, score, priorUtility };
    });
    scored.sort((a, b) => b.score - a.score);
    const winner = scored[0]!;
    const runnerUp = scored[1]?.route ?? null;
    const sortedScores = scored.map((entry) => entry.score);
    const spread = Math.max(...sortedScores) - Math.min(...sortedScores);
    const confidence = Math.round(
      Math.max(35, Math.min(99, 58 + spread * 42 + Math.min(winner.posterior.observations, 20))),
    );
    const mode: RoutingMode =
      winner.posterior.observations < 3 || this.explorationBoost > 0
        ? "exploration"
        : "exploitation";
    const explorationState = this.regimeShift
      ? "regime_shift"
      : winner.posterior.observations < 3
        ? "cold_start"
        : "steady_state";
    const rationale = [
      `Thompson-sampled ${candidates.length} eligible route(s) using context and route features.`,
      mode === "exploration"
        ? "Cold-start or regime-shift exploration is active."
        : "Historical posterior evidence is driving exploitation.",
      runnerUp
        ? `Runner-up ${runnerUp.modelOrAlgorithm} rejected: lower sampled utility under the current Problem State.`
        : "No close competitor remained after sampling.",
      "Enterprise constraints were applied before policy selection.",
    ];
    return {
      policyName: this.name,
      policyVersion: this.version,
      explorationState,
      mode,
      confidence,
      explorationBoost: this.explorationBoost,
      selectedRoute: winner.route,
      candidateRoutes: candidates,
      runnerUp,
      features: winner.features,
      estimatedUtility: winner.priorUtility,
      rationale,
      timestamp: new Date().toISOString(),
    };
  }

  update(route: RouteCandidate, outcome: RoutingOutcome, features: RoutingFeatures): void {
    const posterior = this.posteriorFor(route.routeId, features.values.length);
    const reward = utilityFor(route, outcome);
    const learningRate = 1 / Math.max(1, posterior.observations + 1);
    features.values.forEach((value, index) => {
      posterior.mean[index] += learningRate * (reward - posterior.mean[index] * value) * value;
      posterior.precision[index] = Math.min(1000, posterior.precision[index] + value * value);
    });
    posterior.observations += 1;
    this.recentRewards.push(reward);
    if (this.recentRewards.length > 20) this.recentRewards.shift();
    this.detectAndAdapt();
  }

  explain(decision: AdaptiveRoutingDecision): string[] {
    return decision.rationale;
  }

  getAdaptationState() {
    return {
      regimeShift: this.regimeShift,
      explorationBoost: this.explorationBoost,
      observations: this.recentRewards.length,
    };
  }

  private posteriorFor(routeId: string, dimension: number): Posterior {
    const current = this.posteriors.get(routeId);
    if (current) return current;
    const posterior = {
      mean: Array.from({ length: dimension }, () => 0.05),
      precision: Array.from({ length: dimension }, () => 1),
      observations: 0,
    };
    this.posteriors.set(routeId, posterior);
    return posterior;
  }

  private normalSample() {
    const u = Math.max(this.random(), Number.EPSILON);
    const v = Math.max(this.random(), Number.EPSILON);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  private detectAndAdapt() {
    if (this.recentRewards.length < 8) return;
    const midpoint = Math.floor(this.recentRewards.length / 2);
    const before = this.recentRewards.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
    const after =
      this.recentRewards.slice(midpoint).reduce((a, b) => a + b, 0) /
      (this.recentRewards.length - midpoint);
    this.regimeShift = Math.abs(after - before) > 0.18;
    this.explorationBoost = this.regimeShift ? 0.2 : Math.max(0, this.explorationBoost * 0.7);
    if (this.regimeShift) {
      this.posteriors.forEach((posterior) => {
        posterior.precision = posterior.precision.map((value) => Math.max(0.25, value * 0.85));
      });
    }
  }
}

/** Process-wide learning brain — survives across requests in one server instance. */
export const globalRoutingPolicy = new ThompsonSamplingPolicy();

// ---------------------------------------------------------------------------
// Candidate construction: from allocation plan to routeable candidates.
// ---------------------------------------------------------------------------

export function routesFromAllocation(
  allocation: IntelligenceAllocationPlan,
  catalog: {
    strategy: StrategyKind;
    label: string;
    expectedQuality: number;
    estimatedCost: number;
    latencyMs: number;
    risk: RiskLevel;
  }[],
): RouteCandidate[] {
  const allowed = new Set(allocation.candidateStrategies);
  return catalog
    .filter((entry) => allowed.has(entry.strategy))
    .map((entry) => ({
      routeId: `${allocation.selectedCapability ?? "unassigned"}:${entry.strategy}`,
      capabilityId: allocation.selectedCapability ?? "unassigned",
      capability: allocation.selectedCapability ?? "Unassigned capability",
      intelligenceLevel:
        ({
          deterministic: 0,
          statistical: 1,
          machine_learning: 1,
          small_model: 2,
          small_llm: 2,
          llm: 3,
          specialist_agent: 3,
          advanced_reasoning: 4,
          multi_agent: 5,
          image_generation: 2,
          website_builder: 3,
          human_review: 6,
          human: 6,
        } as const)[entry.strategy] ?? 3,
      strategy: entry.strategy,
      modelOrAlgorithm: entry.label,
      executionMode:
        entry.strategy === "human_review"
          ? "human"
          : entry.strategy === "deterministic" ||
              entry.strategy === "statistical" ||
              entry.strategy === "machine_learning"
            ? "local"
            : "cloud",
      resource:
        entry.strategy === "human_review"
          ? "human"
          : entry.strategy === "deterministic" || entry.strategy === "statistical"
            ? "cpu"
            : "gpu",
      configuration: { source: allocation.selectedCapability ?? "enterprise-registry" },
      estimatedCost: entry.estimatedCost,
      estimatedLatencyMs: entry.latencyMs,
      estimatedQuality: entry.expectedQuality,
      risk: entry.risk,
      source: "allocation",
    }));
}
