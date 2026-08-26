export type StrategyKind =
  | "deterministic"
  | "statistical"
  | "small_llm"
  | "specialist_agent"
  | "advanced_reasoning"
  | "multi_agent"
  | "image_generation"
  | "website_builder"
  | "human";

export type DataType =
  | "structured"
  | "text"
  | "documents"
  | "images"
  | "time_series"
  | "mixed"
  | "unknown";

export type NodeStatus = "queued" | "running" | "completed" | "failed" | "skipped";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type MissionStatus =
  | "pending"
  | "profiling"
  | "routing"
  | "executing"
  | "evaluating"
  | "completed"
  | "failed"
  | "escalated";

export type AgentClass =
  | "llm"
  | "statistical"
  | "ml"
  | "deterministic"
  | "hybrid"
  | "human";

export interface Mission {
  id: string;
  tenantId: string;
  userId: string;
  prompt: string;
  status: MissionStatus;
  domain?: string;
  dataType?: DataType;
  createdAt: string;
  completedAt?: string;
  totalCost?: number;
  totalTokens?: number;
  totalLatencyMs?: number;
  selectedStrategy?: StrategyKind;
  escalationLevel?: number;
  confidence?: number;
}

export interface ProblemProfile {
  id: string;
  missionId: string;
  dataType: DataType;
  complexity: "low" | "medium" | "high" | "critical";
  signals: ProfileSignal[];
  dimensions: ProfileDimension[];
  summary: string;
}

export interface ProfileSignal {
  name: string;
  value: number;
  unit?: string;
}

export interface ProfileDimension {
  name: string;
  score: number;
  maxScore: number;
}

export interface RoutingDecision {
  id: string;
  missionId: string;
  candidates: StrategyCandidate[];
  selectedStrategy: StrategyKind;
  escalationLevel: number;
  voiScore: number;
  confidence: number;
  reasoning: string;
  reasoningBudget: {
    estimatedTokens: number;
    maxTokens: number;
    earlyStop: boolean;
  };
}

export interface StrategyCandidate {
  strategy: StrategyKind;
  name: string;
  suitabilityScore: number;
  estimatedCost: number;
  estimatedLatencyMs: number;
  estimatedQuality: number;
  reasoning: string;
}

export interface ExecutionRun {
  id: string;
  missionId: string;
  nodes: ExecutionNode[];
  status: NodeStatus;
  totalCost: number;
  totalTokens: number;
  totalLatencyMs: number;
  startedAt: string;
  completedAt?: string;
}

export interface ExecutionNode {
  id: string;
  runId: string;
  name: string;
  type: StrategyKind;
  agentId?: string;
  modelId?: string;
  status: NodeStatus;
  stage: string;
  purpose: string;
  input?: string;
  output?: string;
  cost: number;
  tokens: number;
  latencyMs: number;
  confidence: number;
  startTime?: string;
  endTime?: string;
}

export interface Agent {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  agentClass: AgentClass;
  escalationLevel: number;
  purpose: string;
  model?: string;
  tools: string[];
  costProfile: string;
  reliability: number;
  status: "active" | "inactive" | "maintenance";
  fallbackId?: string;
}

export interface ModelRecord {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  provider: string;
  capability: string;
  costPerToken: number;
  latencyMs: number;
  contextWindow: number;
  quality: number;
  placement: "local" | "cloud";
  status: "active" | "inactive" | "deprecated";
}

export interface ToolRecord {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  type: string;
  permissions: string;
  latencyMs: number;
  successRate: number;
  status: "active" | "inactive" | "maintenance";
}

export interface Workflow {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StrategyKind;
  agentId?: string;
  modelId?: string;
  tools: string[];
  timeout: number;
}

export interface DecisionLedgerEntry {
  id: string;
  tenantId: string;
  missionId: string;
  task: string;
  dataProfile: string;
  complexity: string;
  candidates: { name: string; score: number; selected: boolean }[];
  selectedStrategy: string;
  reasoning: string;
  rejectedAlternatives: string;
  llmCalls: number;
  tokens: number;
  cost: number;
  latencyMs: number;
  confidence: number;
  fallbackPath: string;
  outcome: "success" | "partial" | "failure";
  timestamp: string;
}

export interface EvaluationResult {
  id: string;
  missionId: string;
  dimensions: { name: string; score: number; delta?: number }[];
  qualityScore: number;
  outputVerdict: "pass" | "fail" | "review";
  decisionVerdict: "optimal" | "suboptimal" | "escalated";
  feedback: string;
}

export interface CostRecord {
  id: string;
  tenantId: string;
  strategy: StrategyKind;
  executions: number;
  totalCost: number;
  avgCostPerTask: number;
  totalTokens: number;
  avgLatencyMs: number;
}

export interface PortfolioProduct {
  id: string;
  name: string;
  codename: string;
  domain: string;
  description: string;
  agents: string[];
  models: string[];
  tools: string[];
}

export interface ArchitectureLayer {
  id: string;
  number: string;
  name: string;
  tagline: string;
  responsibilities: string[];
  technologies: string[];
  rationale: string[];
}

export interface SystemHealth {
  agentsActive: number;
  agentsTotal: number;
  modelsAvailable: number;
  uptime: string;
  lastMissionAt?: string;
  pendingMissions: number;
}

export interface EscalationLevel {
  level: number;
  name: string;
  description: string;
  examples: string[];
  tokenCost: string;
  latency: string;
  reliability: string;
  color: string;
}
