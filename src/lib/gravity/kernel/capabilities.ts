import type { ProblemState, TaskType } from "./problemState";

export type ExecutionMode = "local" | "cloud" | "distributed" | "human";
export type RiskLevel = "low" | "medium" | "high";
export type StrategyKind =
  | "deterministic"
  | "statistical"
  | "machine_learning"
  | "small_model"
  | "small_llm"
  | "llm"
  | "specialist_agent"
  | "advanced_reasoning"
  | "multi_agent"
  | "image_generation"
  | "website_builder"
  | "human_review"
  | "human";

export interface EnterpriseCapability {
  capabilityId: string;
  name: string;
  domain: string;
  description: string;
  taskTypes: TaskType[];
  inputModalities: string[];
  outputTypes: string[];
  supportedProblemCharacteristics: string[];
  supportedMethods: StrategyKind[];
  requiredData: string[];
  qualityProfile: number;
  latencyProfile: "realtime" | "interactive" | "batch" | "unknown";
  riskProfile: RiskLevel;
  costProfile: "low" | "medium" | "high";
  resourceRequirements: { cpu: number | null; gpu: number | null; memory: number | null };
  approvedModels: string[] | null;
  approvedTools: string[] | null;
  executionModes: ExecutionMode[];
  humanReviewRequirements: "never" | "conditional" | "always";
  policyConstraints: string[];
  version: string;
  enabled: boolean;
}

export interface CapabilityRegistry {
  register(capability: EnterpriseCapability): void;
  list(): EnterpriseCapability[];
  discover(problemState: ProblemState): EnterpriseCapability[];
}

class InMemoryCapabilityRegistry implements CapabilityRegistry {
  private readonly capabilities = new Map<string, EnterpriseCapability>();
  register(capability: EnterpriseCapability) {
    this.capabilities.set(capability.capabilityId, capability);
  }
  list() {
    return [...this.capabilities.values()];
  }
  discover(problemState: ProblemState) {
    return this.list().filter((capability) => {
      if (!capability.enabled) return false;
      if (
        !capability.taskTypes.includes(problemState.intent.taskType) &&
        !capability.taskTypes.includes("unknown")
      )
        return false;
      if (
        problemState.data.type !== "unknown" &&
        capability.inputModalities.length > 0 &&
        !capability.inputModalities.includes(problemState.data.type)
      )
        return false;
      return true;
    });
  }
}

export const capabilityRegistry: CapabilityRegistry = new InMemoryCapabilityRegistry();

// Demo registrations are replaceable enterprise inputs; no domain logic is embedded in the registry.
const demoCapabilities: EnterpriseCapability[] = [
  {
    capabilityId: "enterprise.numeric-computation",
    name: "Numeric Computation",
    domain: "enterprise-defined",
    description: "Compute, compare, or transform structured numerical information.",
    taskTypes: ["calculation", "analysis"],
    inputModalities: ["structured", "time_series", "unknown"],
    outputTypes: ["numeric result", "written analysis"],
    supportedProblemCharacteristics: ["low semantic complexity", "structured data"],
    supportedMethods: ["deterministic", "statistical"],
    requiredData: ["structured inputs"],
    qualityProfile: 88,
    latencyProfile: "interactive",
    riskProfile: "low",
    costProfile: "low",
    resourceRequirements: { cpu: 1, gpu: 0, memory: 1 },
    approvedModels: null,
    approvedTools: ["SQL", "Python"],
    executionModes: ["local", "cloud"],
    humanReviewRequirements: "never",
    policyConstraints: [],
    version: "1.0.0",
    enabled: true,
  },
  {
    capabilityId: "enterprise.temporal-forecasting",
    name: "Temporal Forecasting",
    domain: "enterprise-defined",
    description: "Estimate future values from historical temporal observations.",
    taskTypes: ["forecasting"],
    inputModalities: ["time_series", "structured"],
    outputTypes: ["numeric result"],
    supportedProblemCharacteristics: ["temporal structure", "historical signal"],
    supportedMethods: ["statistical", "machine_learning", "specialist_agent"],
    requiredData: ["historical observations"],
    qualityProfile: 90,
    latencyProfile: "batch",
    riskProfile: "low",
    costProfile: "medium",
    resourceRequirements: { cpu: 2, gpu: null, memory: 4 },
    approvedModels: null,
    approvedTools: ["Python"],
    executionModes: ["local", "cloud", "distributed"],
    humanReviewRequirements: "conditional",
    policyConstraints: [],
    version: "1.0.0",
    enabled: true,
  },
  {
    capabilityId: "enterprise.semantic-synthesis",
    name: "Semantic Synthesis",
    domain: "enterprise-defined",
    description: "Find themes, summarize evidence, and produce an interpretable synthesis.",
    taskTypes: ["summarization", "classification", "analysis"],
    inputModalities: ["text", "documents", "mixed"],
    outputTypes: ["written analysis"],
    supportedProblemCharacteristics: ["unstructured text", "semantic diversity"],
    supportedMethods: ["machine_learning", "small_model", "small_llm", "llm", "specialist_agent"],
    requiredData: ["textual evidence"],
    qualityProfile: 86,
    latencyProfile: "batch",
    riskProfile: "medium",
    costProfile: "medium",
    resourceRequirements: { cpu: 2, gpu: 1, memory: 8 },
    approvedModels: null,
    approvedTools: ["Search"],
    executionModes: ["local", "cloud", "distributed", "human"],
    humanReviewRequirements: "conditional",
    policyConstraints: [],
    version: "1.0.0",
    enabled: true,
  },
  {
    capabilityId: "enterprise.high-consequence-review",
    name: "High-Consequence Review",
    domain: "enterprise-defined",
    description: "Investigate consequential cases with explainability and approval controls.",
    taskTypes: ["investigation", "analysis"],
    inputModalities: ["unknown", "structured", "text", "documents", "mixed"],
    outputTypes: ["written analysis"],
    supportedProblemCharacteristics: ["high risk", "high consequence"],
    supportedMethods: ["specialist_agent", "multi_agent", "human_review"],
    requiredData: ["case evidence"],
    qualityProfile: 96,
    latencyProfile: "interactive",
    riskProfile: "high",
    costProfile: "high",
    resourceRequirements: { cpu: 2, gpu: 1, memory: 8 },
    approvedModels: null,
    approvedTools: null,
    executionModes: ["cloud", "distributed", "human"],
    humanReviewRequirements: "always",
    policyConstraints: ["explainability required", "human approval required"],
    version: "1.0.0",
    enabled: true,
  },
  {
    capabilityId: "enterprise.visual-generation",
    name: "Visual Generation",
    domain: "enterprise-defined",
    description: "Generate images and visual assets from natural-language descriptions.",
    taskTypes: ["creation"],
    inputModalities: ["images", "text", "unknown"],
    outputTypes: ["visual asset"],
    supportedProblemCharacteristics: ["creative intent", "visual output"],
    supportedMethods: ["image_generation", "small_llm"],
    requiredData: ["prompt description"],
    qualityProfile: 84,
    latencyProfile: "interactive",
    riskProfile: "low",
    costProfile: "low",
    resourceRequirements: { cpu: 0, gpu: 1, memory: 2 },
    approvedModels: null,
    approvedTools: ["Pollinations"],
    executionModes: ["cloud"],
    humanReviewRequirements: "never",
    policyConstraints: [],
    version: "1.0.0",
    enabled: true,
  },
  {
    capabilityId: "enterprise.web-artifact",
    name: "Web Artifact Builder",
    domain: "enterprise-defined",
    description: "Produce complete single-page websites and web artifacts from intent.",
    taskTypes: ["creation"],
    inputModalities: ["text", "unknown"],
    outputTypes: ["web artifact"],
    supportedProblemCharacteristics: ["creative intent", "interactive output"],
    supportedMethods: ["website_builder", "small_llm", "specialist_agent"],
    requiredData: ["prompt description"],
    qualityProfile: 88,
    latencyProfile: "batch",
    riskProfile: "low",
    costProfile: "medium",
    resourceRequirements: { cpu: 1, gpu: 1, memory: 4 },
    approvedModels: null,
    approvedTools: null,
    executionModes: ["cloud"],
    humanReviewRequirements: "never",
    policyConstraints: [],
    version: "1.0.0",
    enabled: true,
  },
  {
    capabilityId: "enterprise.general-reasoning",
    name: "General Reasoning",
    domain: "enterprise-defined",
    description:
      "Catch-all reasoning capability: bounded prompts route through the L2-L5 model ladder under Thompson sampling.",
    taskTypes: ["unknown", "creation", "analysis"],
    inputModalities: ["unknown", "text", "structured", "documents", "mixed", "time_series", "images"],
    outputTypes: ["written analysis", "creative artifact"],
    supportedProblemCharacteristics: ["general intent"],
    supportedMethods: ["small_llm", "specialist_agent", "advanced_reasoning", "multi_agent"],
    requiredData: [],
    qualityProfile: 85,
    latencyProfile: "interactive",
    riskProfile: "medium",
    costProfile: "medium",
    resourceRequirements: { cpu: 1, gpu: 1, memory: 4 },
    approvedModels: null,
    approvedTools: null,
    executionModes: ["cloud"],
    humanReviewRequirements: "never",
    policyConstraints: [],
    version: "1.0.0",
    enabled: true,
  },
];

demoCapabilities.forEach((capability) => capabilityRegistry.register(capability));
