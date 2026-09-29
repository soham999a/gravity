import type { ProblemStateProfile } from "./problemState";
import type { RiskLevel, StrategyKind, CapabilityRegistry, EnterpriseCapability } from "./capabilities";
import { capabilityRegistry } from "./capabilities";

export interface EnterpriseContext {
  tenant?: string | null;
  domain?: string | null;
  approvedCapabilities?: string[] | null;
  restrictedCapabilities?: string[] | null;
  approvedModels?: string[] | null;
  approvedTools?: string[] | null;
  policyConstraints?: string[] | null;
  maxRiskLevel?: RiskLevel | null;
  humanApprovalRequired?: boolean;
}

/** Escalation level per strategy — the least-complex-sufficient ladder. */
export const STRATEGY_LEVEL: Record<StrategyKind, number> = {
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
};

export const strategyLevel = (strategy: StrategyKind): number => STRATEGY_LEVEL[strategy];

export interface IntelligenceAllocationPlan {
  problemState: ProblemStateProfile["problemState"];
  profiling: ProblemStateProfile["profiling"];
  enterpriseContext: EnterpriseContext;
  discoveredCapabilities: string[];
  eligibleCapabilities: string[];
  rejectedCapabilities: { capabilityId: string; reasons: string[] }[];
  selectedCapability: string | null;
  candidateStrategies: StrategyKind[];
  selectedStrategy: StrategyKind | null;
  executionMode: string | null;
  escalationLevel: number | null;
  rationale: string[];
  allocationStatus: "allocated" | "needs_clarification" | "no_eligible_capability";
}

const riskRank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function rejectReasons(
  capability: EnterpriseCapability,
  context: EnterpriseContext,
  state: ProblemStateProfile["problemState"],
) {
  const reasons: string[] = [];
  if (
    context.approvedCapabilities &&
    !context.approvedCapabilities.includes(capability.capabilityId)
  )
    reasons.push("not approved by enterprise policy");
  if (context.restrictedCapabilities?.includes(capability.capabilityId))
    reasons.push("explicitly restricted by enterprise policy");
  if (context.maxRiskLevel && riskRank[capability.riskProfile] > riskRank[context.maxRiskLevel])
    reasons.push(`risk exceeds ${context.maxRiskLevel} ceiling`);
  if (context.humanApprovalRequired && capability.humanReviewRequirements === "never")
    reasons.push("human approval required");
  if (state.risk.complianceSensitivity && capability.riskProfile === "low")
    reasons.push("compliance-sensitive task requires governed capability");
  return reasons;
}

export function allocateIntelligence(
  problem: ProblemStateProfile,
  enterpriseContext: EnterpriseContext = {},
  registry: CapabilityRegistry = capabilityRegistry,
): IntelligenceAllocationPlan {
  const state = problem.problemState;
  const discovered = registry.discover(state);
  const rejectedCapabilities = discovered
    .map((capability) => ({
      capabilityId: capability.capabilityId,
      reasons: rejectReasons(capability, enterpriseContext, state),
    }))
    .filter((entry) => entry.reasons.length > 0);
  const eligible = discovered.filter(
    (capability) =>
      !rejectedCapabilities.some((entry) => entry.capabilityId === capability.capabilityId),
  );
  const selected = [...eligible].sort((a, b) => b.qualityProfile - a.qualityProfile)[0];
  const candidateStrategies = selected?.supportedMethods ?? [];
  const selectedStrategy = selected
    ? ([...candidateStrategies]
        .sort((a, b) => strategyLevel(a) - strategyLevel(b))
        .find((strategy) => strategyLevel(strategy) >= (state.risk.level === "high" ? 3 : 0)) ??
      candidateStrategies[0] ??
      null)
    : null;
  const requiresHuman =
    state.risk.humanReviewRequired === true || selected?.humanReviewRequirements === "always";
  const finalStrategy = requiresHuman ? "human_review" : selectedStrategy;
  return {
    problemState: state,
    profiling: problem.profiling,
    enterpriseContext,
    discoveredCapabilities: discovered.map((capability) => capability.capabilityId),
    eligibleCapabilities: eligible.map((capability) => capability.capabilityId),
    rejectedCapabilities,
    selectedCapability: selected?.capabilityId ?? null,
    candidateStrategies,
    selectedStrategy: finalStrategy,
    executionMode:
      finalStrategy === "human_review" ? "human" : (selected?.executionModes[0] ?? null),
    escalationLevel: finalStrategy ? strategyLevel(finalStrategy) : null,
    rationale: selected
      ? [
          `Capability discovered from enterprise registry: ${selected.name}.`,
          `${eligible.length} capability candidate(s) remain after policy filtering.`,
          "Selected the least complex supported strategy before routing computation.",
          ...(requiresHuman
            ? ["Human review is required by problem risk or capability policy."]
            : []),
        ]
      : [
          "No eligible enterprise capability was found for this Problem State.",
          "Clarification or enterprise capability registration is required before execution.",
        ],
    allocationStatus:
      state.uncertainty.ambiguity > 65
        ? "needs_clarification"
        : selected
          ? "allocated"
          : "no_eligible_capability",
  };
}
