/**
 * UPSP-style deep problem profiler (ported from intelligence-fabric).
 * Deterministic, zero-token: turns a raw prompt into a structured ProblemState
 * that the capability registry and Thompson router reason over.
 */

export type ProfilingLevel = 0 | 1 | 2 | 3;
export type ProfilingMethod = "deterministic" | "deterministic+statistical";
export type KnowledgeStatus = "known" | "estimated" | "unknown" | "unavailable";
export type TaskType =
  | "calculation"
  | "forecasting"
  | "optimization"
  | "analysis"
  | "summarization"
  | "classification"
  | "creation"
  | "investigation"
  | "unknown";

export interface ProfilingInput {
  task: string;
  context?: Record<string, unknown>;
  dataReference?: string;
  constraints?: Record<string, unknown>;
}

export interface ProblemState {
  intent: {
    rawInput: string;
    normalizedInput: string;
    taskType: TaskType;
    objective: string | null;
    requestedOperation: string | null;
    expectedOutputType: string | null;
  };
  data: {
    present: boolean;
    type: string;
    modality: string | null;
    structure: "structured" | "semi_structured" | "unstructured" | "unknown";
    numericalFeatures: number | null;
    categoricalFeatures: number | null;
    textualFeatures: number | null;
    temporalFeatures: number | null;
    volume: number | null;
    dimensionality: number | null;
    missingness: number | null;
    duplication: number | null;
    semanticDiversity: number | null;
    schemaComplexity: number | null;
  };
  complexity: {
    task: number;
    computationalEstimate: number;
    reasoning: number;
    workflow: number;
    dependencyDepth: number | null;
    toolRequirement: boolean | null;
    multiStepRequirement: boolean | null;
  };
  uncertainty: {
    input: number;
    data: number;
    model: number | null;
    outcome: number;
    confidence: number;
    ambiguity: number;
  };
  risk: {
    level: "low" | "medium" | "high";
    consequenceLevel: "low" | "medium" | "high" | "unknown";
    safetySensitivity: boolean | null;
    privacySensitivity: boolean | null;
    complianceSensitivity: boolean | null;
    humanReviewRequired: boolean | null;
  };
  quality: {
    requiredAccuracy: number | null;
    requiredReliability: number | null;
    threshold: number | null;
    explainability: "low" | "medium" | "high" | "unknown";
    reproducibility: "low" | "medium" | "high" | "unknown";
  };
  latency: {
    requirement: "realtime" | "interactive" | "batch" | "unknown";
    deadline: string | null;
    realtime: boolean | null;
    batchOrOnline: "batch" | "online" | "unknown";
    acceptableTailLatency: number | null;
  };
  resources: {
    availableCpu: number | null;
    availableGpu: number | null;
    memoryAvailable: number | null;
    networkConstraints: string | null;
    availableModels: string[] | null;
    availableAlgorithms: string[] | null;
    availableAgents: string[] | null;
    availableTools: string[] | null;
    tokenBudget: number | null;
    computeBudget: number | null;
    monetaryBudget: number | null;
  };
  enterpriseContext: {
    tenant: string | null;
    domain: string | null;
    allowedCapabilities: string[] | null;
    restrictedCapabilities: string[] | null;
    approvedModels: string[] | null;
    dataResidency: string | null;
    policyConstraints: string[] | null;
    governanceConstraints: string[] | null;
  };
}

export interface ProfilingMetadata {
  method: ProfilingMethod;
  level: ProfilingLevel;
  confidence: number;
  completeness: number;
  latencyMs: number;
  profilerVersion: string;
  timestamp: string;
  unavailableFields: string[];
}

export interface ProblemStateVector {
  intent: TaskType;
  dataState: string;
  complexity: number;
  uncertainty: number;
  risk: "low" | "medium" | "high";
  qualityRequirement: number | null;
  latencyRequirement: ProblemState["latency"]["requirement"];
  resourceState: "constrained" | "available" | "unknown";
  policyState: "constrained" | "available" | "unknown";
  historicalContext: null;
}

export interface ProblemStateProfile {
  problemState: ProblemState;
  stateVector: ProblemStateVector;
  profiling: ProfilingMetadata;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const has = (text: string, words: string[]) => words.some((word) => text.includes(word));
const extractNumber = (text: string): number | null => {
  const match = text.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|thousand)?\b/i);
  if (!match) return null;
  const base = Number(match[1]!.replaceAll(",", ""));
  const multiplier =
    match[2]?.toLowerCase() === "m" || match[2]?.toLowerCase() === "million"
      ? 1_000_000
      : match[2]?.toLowerCase() === "k" || match[2]?.toLowerCase() === "thousand"
        ? 1_000
        : 1;
  return Number.isFinite(base) ? base * multiplier : null;
};

function taskTypeFor(text: string): TaskType {
  if (has(text, ["forecast", "predict", "demand", "next quarter", "next month"]))
    return "forecasting";
  if (has(text, ["summarize", "summarise", "summary", "themes", "recurring"]))
    return "summarization";
  if (has(text, ["average", "calculate", "compute", "sum", "count", "percentage"]))
    return "calculation";
  if (has(text, ["optimize", "optimise", "route", "schedule", "minimize", "maximise", "maximize"]))
    return "optimization";
  if (has(text, ["classify", "categorize", "label", "segment"])) return "classification";
  if (has(text, ["investigate", "incident", "root cause", "why did", "recommend action"]))
    return "investigation";
  if (has(text, ["create", "write", "design", "build", "generate"])) return "creation";
  if (has(text, ["analyze", "analyse", "assess", "compare", "identify"])) return "analysis";
  return "unknown";
}

function dataTypeFor(text: string, taskType: TaskType): string {
  if (has(text, ["complaint", "feedback", "review", "document", "text", "narrative"]))
    return "text";
  if (
    has(text, [
      "historical",
      "time series",
      "monthly",
      "quarterly",
      "seasonal",
      "anomal",
      "spike",
      "kwh",
      "forecast",
    ])
  )
    return "time_series";
  if (has(text, ["image", "photo", "visual"])) return "images";
  if (has(text, ["csv", "table", "database", "revenue", "sales", "units", "numerical"]))
    return "structured";
  if (taskType === "creation") return "unknown";
  return "unknown";
}

export function profileProblemState(input: ProfilingInput): ProblemStateProfile {
  const started = Date.now();
  const rawInput = input.task;
  const normalizedInput = rawInput.trim().replace(/\s+/g, " ");
  const text = normalizedInput.toLowerCase();
  const taskType = taskTypeFor(text);
  const dataType = dataTypeFor(text, taskType);
  const dataPresent = Boolean(input.dataReference) || dataType !== "unknown";
  const isText = dataType === "text";
  const isTemporal = dataType === "time_series";
  const isStructured = dataType === "structured" || isTemporal;
  const highRisk = has(text, [
    "compliance",
    "incident",
    "legal",
    "medical",
    "safety",
    "security",
    "fraud",
  ]);
  const explicitHighConsequence = has(text, [
    "high-risk",
    "high risk",
    "critical",
    "recommend action",
  ]);
  const ambiguous =
    normalizedInput.length < 24 ||
    taskType === "unknown" ||
    has(text, ["something", "help me", "do this"]);
  const volume = extractNumber(text);
  const complexity = clamp(
    18 +
      (taskType === "unknown" ? 22 : 0) +
      (isText ? 18 : 0) +
      (isTemporal ? 12 : 0) +
      (has(text, ["across", "multiple", "workflow", "and"]) ? 18 : 0) +
      (highRisk ? 15 : 0),
  );
  const uncertainty = clamp(
    18 +
      (ambiguous ? 48 : 0) +
      (dataType === "unknown" ? 24 : 0) +
      (isTemporal ? 12 : 0) +
      (isText ? 8 : 0),
  );
  const risk: "low" | "medium" | "high" = highRisk
    ? "high"
    : explicitHighConsequence
      ? "medium"
      : "low";
  const completeness = clamp(
    52 + (dataPresent ? 15 : 0) + (dataType !== "unknown" ? 15 : 0) + (!ambiguous ? 12 : 0),
  );
  const confidence = clamp(100 - Math.round((uncertainty + (dataType === "unknown" ? 20 : 0)) / 2));
  const objective = taskType === "unknown" ? null : normalizedInput.replace(/[.!?]+$/, "");
  const expectedOutputType =
    taskType === "calculation" || taskType === "forecasting"
      ? "numeric result"
      : taskType === "summarization" || taskType === "analysis" || taskType === "investigation"
        ? "written analysis"
        : taskType === "optimization"
          ? "optimized plan"
          : taskType === "creation"
            ? "creative artifact"
            : null;
  const unavailableFields = [
    ...(input.dataReference ? [] : ["data.volume", "data.missingness", "data.duplication"]),
    ...(input.constraints
      ? []
      : ["latency.deadline", "resources.tokenBudget", "resources.monetaryBudget"]),
    ...(input.context ? [] : ["enterpriseContext.tenant", "enterpriseContext.domain"]),
  ];
  const problemState: ProblemState = {
    intent: {
      rawInput,
      normalizedInput,
      taskType,
      objective,
      requestedOperation: taskType === "unknown" ? null : taskType,
      expectedOutputType,
    },
    data: {
      present: dataPresent,
      type: dataType,
      modality: isText ? "text" : isTemporal ? "time_series" : isStructured ? "tabular" : null,
      structure: isText ? "unstructured" : isStructured ? "structured" : "unknown",
      numericalFeatures: null,
      categoricalFeatures: null,
      textualFeatures: null,
      temporalFeatures: null,
      volume,
      dimensionality: null,
      missingness: null,
      duplication: null,
      semanticDiversity: isText ? 55 : null,
      schemaComplexity: isStructured ? (taskType === "optimization" ? 72 : 34) : null,
    },
    complexity: {
      task: complexity,
      computationalEstimate: clamp(complexity + (taskType === "optimization" ? 18 : 0)),
      reasoning: clamp((isText ? 48 : 12) + (highRisk ? 25 : 0) + (ambiguous ? 20 : 0)),
      workflow: clamp((has(text, ["and", "across", "recommend"]) ? 55 : 18) + (highRisk ? 20 : 0)),
      dependencyDepth: null,
      toolRequirement: null,
      multiStepRequirement: has(text, ["and", "across", "recommend", "investigate"]) || null,
    },
    uncertainty: {
      input: ambiguous ? 78 : 18,
      data: dataType === "unknown" ? 72 : isText || isTemporal ? 38 : 14,
      model: null,
      outcome: clamp(uncertainty + (highRisk ? 12 : 0)),
      confidence,
      ambiguity: ambiguous ? 82 : 12,
    },
    risk: {
      level: risk,
      consequenceLevel: highRisk || explicitHighConsequence ? "high" : "low",
      safetySensitivity: highRisk || null,
      privacySensitivity: has(text, ["customer", "personal", "patient", "employee"]) || null,
      complianceSensitivity: has(text, ["compliance", "regulatory", "audit"]) || null,
      humanReviewRequired: highRisk || null,
    },
    quality: {
      requiredAccuracy: highRisk
        ? 95
        : taskType === "forecasting" || taskType === "optimization"
          ? 85
          : null,
      requiredReliability: highRisk ? 95 : null,
      threshold: null,
      explainability: highRisk
        ? "high"
        : taskType === "analysis" || taskType === "investigation"
          ? "medium"
          : "unknown",
      reproducibility: isStructured ? "high" : "unknown",
    },
    latency: {
      requirement: has(text, ["real-time", "realtime", "immediately"]) ? "realtime" : "unknown",
      deadline: null,
      realtime: has(text, ["real-time", "realtime"]) || null,
      batchOrOnline: volume && volume > 1000 ? "batch" : "unknown",
      acceptableTailLatency: null,
    },
    resources: {
      availableCpu: null,
      availableGpu: null,
      memoryAvailable: null,
      networkConstraints: null,
      availableModels: null,
      availableAlgorithms: null,
      availableAgents: null,
      availableTools: null,
      tokenBudget: null,
      computeBudget: null,
      monetaryBudget: null,
    },
    enterpriseContext: {
      tenant: null,
      domain: null,
      allowedCapabilities: null,
      restrictedCapabilities: null,
      approvedModels: null,
      dataResidency: null,
      policyConstraints: null,
      governanceConstraints: null,
    },
  };
  const stateVector: ProblemStateVector = {
    intent: taskType,
    dataState: dataType,
    complexity,
    uncertainty,
    risk,
    qualityRequirement: problemState.quality.requiredAccuracy,
    latencyRequirement: problemState.latency.requirement,
    resourceState: "unknown",
    policyState: "unknown",
    historicalContext: null,
  };
  return {
    problemState,
    stateVector,
    profiling: {
      method: isStructured || isText ? "deterministic+statistical" : "deterministic",
      level: dataPresent ? 1 : 0,
      confidence,
      completeness,
      latencyMs: Math.max(0, Date.now() - started),
      profilerVersion: "0.1.0",
      timestamp: new Date().toISOString(),
      unavailableFields,
    },
  };
}
