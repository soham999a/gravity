// GRAVITY domain model. Shared by mock adapters today and real API adapters later.

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
  | "human_review"
  | "human";

export type RiskLevel = "low" | "medium" | "high";

export type DataType =
  | "structured"
  | "text"
  | "documents"
  | "images"
  | "time_series"
  | "mixed"
  | "unknown";

export interface Mission {
  id: string;
  prompt: string;
  createdAt: string;
  dataType: DataType;
  domain?: string;
}

export interface ProfileSignal {
  label: string;
  value: string;
  score?: number;
}

export interface ProblemProfile {
  missionId: string;
  dataType: DataType;
  signals: ProfileSignal[];
  summary: string[];
  recommendedStrategy: StrategyKind;
  dimensions: { label: string; score: number }[];
}

export interface IntelligenceStrategy {
  kind: StrategyKind;
  label: string;
  suitability: number;
  expectedQuality: number;
  estimatedCost: number;
  latencyMs: number;
  risk: RiskLevel;
  confidence: number;
}

export interface ValueOfIntelligence {
  currentQuality: number;
  additionalQuality: number;
  additionalCost: number;
  latencyImpactMs: number;
  riskImpact: RiskLevel;
  verdict: "sufficient" | "escalate";
}

export interface ReasoningBudget {
  tokenBudget: number;
  usedTokens: number;
  expectedCost: number;
  actualCost: number;
  confidence: number;
  decision: "stop" | "escalate";
}

export interface RoutingDecision {
  missionId: string;
  candidates: IntelligenceStrategy[];
  selected: StrategyKind;
  selectedLabel: string;
  reason: string;
  escalationLevel: number;
  valueOfIntelligence: ValueOfIntelligence;
  budget: ReasoningBudget;
}

export type NodeStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "escalated"
  | "skipped";

export interface ExecutionNode {
  id: string;
  name: string;
  type: string;
  purpose: string;
  input: string;
  output: string;
  status: NodeStatus;
  durationMs: number;
  cost: number;
  tokens: number;
  confidence: number;
  parents: string[];
  column: number;
}

export interface ExecutionRun {
  id: string;
  missionId: string;
  missionPrompt: string;
  startedAt: string;
  nodes: ExecutionNode[];
  status: NodeStatus;
  llmCalls: number;
  totalTokens: number;
  totalCost: number;
}

export type AgentClass =
  | "llm"
  | "statistical"
  | "ml"
  | "deterministic"
  | "hybrid"
  | "human";

export interface Agent {
  id: string;
  name: string;
  agentClass: AgentClass;
  typeLabel: string;
  capability: string;
  model: string;
  tools: string[];
  llmRequired: boolean;
  reliability: number;
  status: "available" | "degraded" | "offline";
}

export interface ModelRecord {
  id: string;
  name: string;
  capability: string;
  costProfile: string;
  latencyProfile: string;
  contextCapacity: string;
  quality: number;
  availability: number;
  placement: "local" | "cloud";
  status: "available" | "degraded" | "offline";
}

export interface ToolRecord {
  id: string;
  name: string;
  type: string;
  permission: "read" | "write" | "execute" | "restricted";
  status: "available" | "degraded" | "offline";
  avgLatencyMs: number;
  successRate: number;
}

export type WorkflowNodeType =
  | "mission"
  | "router"
  | "agent"
  | "model"
  | "tool"
  | "condition"
  | "evaluator"
  | "human_approval"
  | "output";

export interface WorkflowNode {
  id: string;
  name: string;
  type: WorkflowNodeType;
  config: Record<string, string>;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface DecisionLedgerEntry {
  id: string;
  task: string;
  profile: string;
  candidates: { label: string; suitability: number }[];
  selected: string;
  reason: string[];
  expectedQuality: number;
  actualQuality: number;
  latencyMs: number;
  cost: number;
  tokens: number;
  llmCalls: number;
  fallback: string;
  confidence: number;
  timestamp: string;
}

export interface EvaluationResult {
  dimension: string;
  score: number;
  delta: number;
  note: string;
}

export interface CostRecord {
  label: string;
  executions: number;
  llmCalls: number;
  tokens: number;
  cost: number;
}
