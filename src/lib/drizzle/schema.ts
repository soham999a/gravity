import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  real,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";

export const missionStatusEnum = pgEnum("mission_status", [
  "pending", "profiling", "routing", "executing", "evaluating", "completed", "failed", "escalated",
]);
export const nodeStatusEnum = pgEnum("node_status", [
  "queued", "running", "completed", "failed", "skipped",
]);
export const agentClassEnum = pgEnum("agent_class", [
  "llm", "statistical", "ml", "deterministic", "hybrid", "human",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").default("free"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  email: text("email").notNull().unique(),
  role: text("role").default("viewer"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  agentClass: agentClassEnum("agent_class").notNull(),
  escalationLevel: integer("escalation_level").notNull(),
  purpose: text("purpose"),
  model: text("model"),
  tools: jsonb("tools").$type<string[]>().default([]),
  costProfile: text("cost_profile"),
  reliability: real("reliability").default(0),
  status: text("status").default("active"),
  fallbackId: uuid("fallback_id"),
});

export const models = pgTable("models", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  provider: text("provider"),
  capability: text("capability"),
  costPerToken: real("cost_per_token").default(0),
  latencyMs: integer("latency_ms").default(0),
  contextWindow: integer("context_window").default(0),
  quality: real("quality").default(0),
  placement: text("placement").default("local"),
  status: text("status").default("active"),
});

export const tools = pgTable("tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  type: text("type"),
  permissions: text("permissions"),
  latencyMs: integer("latency_ms").default(0),
  successRate: real("success_rate").default(1),
  status: text("status").default("active"),
});

export const missions = pgTable("missions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  userId: uuid("user_id").references(() => users.id),
  prompt: text("prompt").notNull(),
  status: missionStatusEnum("status").default("pending"),
  domain: text("domain"),
  dataType: text("data_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  totalCost: real("total_cost").default(0),
  totalTokens: integer("total_tokens").default(0),
  totalLatencyMs: integer("total_latency_ms").default(0),
  selectedStrategy: text("selected_strategy"),
  escalationLevel: integer("escalation_level"),
  confidence: real("confidence"),
});

export const problemProfiles = pgTable("problem_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id").references(() => missions.id),
  dataType: text("data_type"),
  complexity: text("complexity"),
  signals: jsonb("signals").$type<{ name: string; value: number; unit?: string }[]>().default([]),
  dimensions: jsonb("dimensions").$type<{ name: string; score: number; maxScore: number }[]>().default([]),
  summary: text("summary"),
});

export const routingDecisions = pgTable("routing_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id").references(() => missions.id),
  candidates: jsonb("candidates").$type<{ strategy: string; name: string; suitabilityScore: number; estimatedCost: number; estimatedLatencyMs: number; estimatedQuality: number; reasoning: string }[]>().default([]),
  selectedStrategy: text("selected_strategy"),
  escalationLevel: integer("escalation_level"),
  voiScore: real("voi_score"),
  confidence: real("confidence"),
  reasoning: text("reasoning"),
  estimatedTokens: integer("estimated_tokens"),
  maxTokens: integer("max_tokens"),
  earlyStop: boolean("early_stop").default(false),
});

export const executionRuns = pgTable("execution_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id").references(() => missions.id),
  status: nodeStatusEnum("status").default("queued"),
  totalCost: real("total_cost").default(0),
  totalTokens: integer("total_tokens").default(0),
  totalLatencyMs: integer("total_latency_ms").default(0),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const executionNodes = pgTable("execution_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").references(() => executionRuns.id),
  name: text("name"),
  type: text("type"),
  agentId: uuid("agent_id"),
  modelId: uuid("model_id"),
  status: nodeStatusEnum("status").default("queued"),
  stage: text("stage"),
  purpose: text("purpose"),
  input: text("input"),
  output: text("output"),
  cost: real("cost").default(0),
  tokens: integer("tokens").default(0),
  latencyMs: integer("latency_ms").default(0),
  confidence: real("confidence").default(0),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
});

export const decisionLedger = pgTable("decision_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  missionId: uuid("mission_id").references(() => missions.id),
  task: text("task"),
  dataProfile: text("data_profile"),
  complexity: text("complexity"),
  candidates: jsonb("candidates").$type<{ name: string; score: number; selected: boolean }[]>().default([]),
  selectedStrategy: text("selected_strategy"),
  reasoning: text("reasoning"),
  rejectedAlternatives: text("rejected_alternatives"),
  llmCalls: integer("llm_calls").default(0),
  tokens: integer("tokens").default(0),
  cost: real("cost").default(0),
  latencyMs: integer("latency_ms").default(0),
  confidence: real("confidence"),
  fallbackPath: text("fallback_path"),
  outcome: text("outcome"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const evaluations = pgTable("evaluations", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id").references(() => missions.id),
  dimensions: jsonb("dimensions").$type<{ name: string; score: number; delta?: number }[]>().default([]),
  qualityScore: real("quality_score"),
  outputVerdict: text("output_verdict"),
  decisionVerdict: text("decision_verdict"),
  feedback: text("feedback"),
});

export const workflows = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  steps: jsonb("steps").$type<{ id: string; name: string; type: string; tools: string[]; timeout: number }[]>().default([]),
});
