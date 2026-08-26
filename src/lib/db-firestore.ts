/**
 * Firestore database layer — replaces Drizzle/PostgreSQL.
 * All data lives in Firestore (free Spark plan: 1 GiB storage, 50K reads/day).
 */

import { adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function col(name: string) {
  return adminDb.collection(name);
}

function docId(): string {
  return adminDb.collection("_").doc().id;
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export interface TenantDoc {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export async function getOrCreateTenant(slug: string, name: string): Promise<TenantDoc> {
  const snap = await col("tenants").where("slug", "==", slug).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0]!;
    return { id: doc.id, ...doc.data() } as TenantDoc;
  }
  const id = docId();
  const tenant: TenantDoc = { id, name, slug, createdAt: new Date().toISOString() };
  await col("tenants").doc(id).set(tenant);
  return tenant;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserDoc {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  name: string | null,
): Promise<UserDoc> {
  const doc = await col("users").doc(uid).get();
  if (doc.exists) {
    return { id: doc.id, ...doc.data() } as UserDoc;
  }
  // Auto-provision tenant + user on first login
  const slugBase = email
    .split("@")[0]!
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 24);
  const slug = `${slugBase}-${uid.slice(0, 8)}`;
  const tenant = await getOrCreateTenant(slug, `${slugBase}'s workspace`);

  const user: UserDoc = {
    id: uid,
    tenantId: tenant.id,
    email,
    name: name ?? null,
    role: "owner",
    createdAt: new Date().toISOString(),
  };
  await col("users").doc(uid).set(user);
  return user;
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

export interface MissionDoc {
  id: string;
  tenantId: string;
  userId: string;
  prompt: string;
  status: string;
  domain: string | null;
  dataType: string | null;
  selectedStrategy: string | null;
  escalationLevel: number | null;
  confidence: number | null;
  totalCost: number | null;
  totalTokens: number | null;
  totalLatencyMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

export async function createMission(data: Omit<MissionDoc, "id" | "createdAt">): Promise<MissionDoc> {
  const id = docId();
  const mission: MissionDoc = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  };
  await col("missions").doc(id).set(mission);
  return mission;
}

export async function getMission(id: string): Promise<MissionDoc | null> {
  const doc = await col("missions").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as MissionDoc;
}

export async function updateMission(id: string, data: Partial<MissionDoc>): Promise<void> {
  await col("missions").doc(id).update(data);
}

export async function listMissions(tenantId: string, limit = 50): Promise<MissionDoc[]> {
  const snap = await col("missions")
    .where("tenantId", "==", tenantId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MissionDoc));
}

export async function deleteMission(id: string): Promise<void> {
  // Cascade delete: execution nodes, runs, profiles, routing, evaluations, ledger
  const batch = adminDb.batch();

  const runsSnap = await col("executionRuns").where("missionId", "==", id).get();
  for (const run of runsSnap.docs) {
    const nodesSnap = await col("executionNodes").where("runId", "==", run.id).get();
    for (const node of nodesSnap.docs) batch.delete(node.ref);
    batch.delete(run.ref);
  }

  const profileSnap = await col("problemProfiles").where("missionId", "==", id).get();
  for (const d of profileSnap.docs) batch.delete(d.ref);

  const routingSnap = await col("routingDecisions").where("missionId", "==", id).get();
  for (const d of routingSnap.docs) batch.delete(d.ref);

  const evalSnap = await col("evaluations").where("missionId", "==", id).get();
  for (const d of evalSnap.docs) batch.delete(d.ref);

  const ledgerSnap = await col("decisionLedger").where("missionId", "==", id).get();
  for (const d of ledgerSnap.docs) batch.delete(d.ref);

  batch.delete(col("missions").doc(id));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Problem Profiles
// ---------------------------------------------------------------------------

export interface ProblemProfileDoc {
  id: string;
  missionId: string;
  dataType: string;
  complexity: string;
  signals: unknown[];
  dimensions: unknown[];
  summary: string;
}

export async function createProblemProfile(data: Omit<ProblemProfileDoc, "id">): Promise<ProblemProfileDoc> {
  const id = docId();
  const doc: ProblemProfileDoc = { ...data, id };
  await col("problemProfiles").doc(id).set(doc);
  return doc;
}

export async function getProblemProfile(missionId: string): Promise<ProblemProfileDoc | null> {
  const snap = await col("problemProfiles").where("missionId", "==", missionId).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...d.data() } as ProblemProfileDoc;
}

// ---------------------------------------------------------------------------
// Routing Decisions
// ---------------------------------------------------------------------------

export interface RoutingDecisionDoc {
  id: string;
  missionId: string;
  candidates: unknown[];
  selectedStrategy: string;
  escalationLevel: number;
  voiScore: number;
  confidence: number;
  reasoning: string;
}

export async function createRoutingDecision(data: Omit<RoutingDecisionDoc, "id">): Promise<RoutingDecisionDoc> {
  const id = docId();
  const doc: RoutingDecisionDoc = { ...data, id };
  await col("routingDecisions").doc(id).set(doc);
  return doc;
}

export async function getRoutingDecision(missionId: string): Promise<RoutingDecisionDoc | null> {
  const snap = await col("routingDecisions").where("missionId", "==", missionId).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...d.data() } as RoutingDecisionDoc;
}

// ---------------------------------------------------------------------------
// Execution Runs
// ---------------------------------------------------------------------------

export interface ExecutionRunDoc {
  id: string;
  missionId: string;
  status: string;
  totalCost: number;
  totalTokens: number;
  totalLatencyMs: number;
  startedAt: string;
  completedAt: string | null;
}

export async function createExecutionRun(missionId: string): Promise<ExecutionRunDoc> {
  const id = docId();
  const run: ExecutionRunDoc = {
    id,
    missionId,
    status: "running",
    totalCost: 0,
    totalTokens: 0,
    totalLatencyMs: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  await col("executionRuns").doc(id).set(run);
  return run;
}

export async function updateExecutionRun(id: string, data: Partial<ExecutionRunDoc>): Promise<void> {
  await col("executionRuns").doc(id).update(data);
}

export async function getExecutionRuns(missionId: string): Promise<ExecutionRunDoc[]> {
  const snap = await col("executionRuns").where("missionId", "==", missionId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExecutionRunDoc));
}

// ---------------------------------------------------------------------------
// Execution Nodes
// ---------------------------------------------------------------------------

export interface ExecutionNodeDoc {
  id: string;
  runId: string;
  name: string;
  type: string;
  status: string;
  stage: string;
  purpose: string;
  input: string | null;
  output: string | null;
  tokens: number;
  latencyMs: number;
  cost: number;
  confidence: number;
  startTime: string;
  endTime: string | null;
}

export async function createExecutionNode(data: Omit<ExecutionNodeDoc, "id">): Promise<ExecutionNodeDoc> {
  const id = docId();
  const node: ExecutionNodeDoc = { ...data, id };
  await col("executionNodes").doc(id).set(node);
  return node;
}

export async function updateExecutionNode(id: string, data: Partial<ExecutionNodeDoc>): Promise<void> {
  await col("executionNodes").doc(id).update(data);
}

export async function getExecutionNodes(runId: string): Promise<ExecutionNodeDoc[]> {
  const snap = await col("executionNodes").where("runId", "==", runId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExecutionNodeDoc));
}

// ---------------------------------------------------------------------------
// Evaluations
// ---------------------------------------------------------------------------

export interface EvaluationDoc {
  id: string;
  missionId: string;
  dimensions: unknown[];
  qualityScore: number;
  outputVerdict: string;
  decisionVerdict: string;
  feedback: string;
}

export async function createEvaluation(data: Omit<EvaluationDoc, "id">): Promise<EvaluationDoc> {
  const id = docId();
  const doc: EvaluationDoc = { ...data, id };
  await col("evaluations").doc(id).set(doc);
  return doc;
}

export async function getEvaluation(missionId: string): Promise<EvaluationDoc | null> {
  const snap = await col("evaluations").where("missionId", "==", missionId).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...d.data() } as EvaluationDoc;
}

// ---------------------------------------------------------------------------
// Decision Ledger
// ---------------------------------------------------------------------------

export interface DecisionLedgerDoc {
  id: string;
  tenantId: string;
  missionId: string;
  task: string;
  dataProfile: string;
  complexity: string;
  candidates: unknown[];
  selectedStrategy: string;
  reasoning: string;
  rejectedAlternatives: string;
  llmCalls: number;
  tokens: number;
  cost: number;
  latencyMs: number;
  confidence: number;
  fallbackPath: string;
  outcome: string;
  timestamp: string;
}

export async function createDecisionLedgerEntry(data: Omit<DecisionLedgerDoc, "id" | "timestamp">): Promise<DecisionLedgerDoc> {
  const id = docId();
  const doc: DecisionLedgerDoc = { ...data, id, timestamp: new Date().toISOString() };
  await col("decisionLedger").doc(id).set(doc);
  return doc;
}
