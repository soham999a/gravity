/**
 * Database layer — Firestore with in-memory fallback.
 * Every Firestore path is try/caught: if Firestore throws (DB not created,
 * network error, missing index, etc.) we silently fall back to in-memory
 * so the app always works.
 */

import { isFirebaseReady, adminDb } from "./firebase-admin";

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function col(name: string) {
  return adminDb.collection(name);
}

function docId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function useFirestore(): boolean {
  try {
    return isFirebaseReady();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback store
// ---------------------------------------------------------------------------

const memStore: Record<string, Record<string, unknown>> = {};

function memCol(name: string): Record<string, unknown> {
  if (!memStore[name]) memStore[name] = {};
  return memStore[name];
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
  if (useFirestore()) {
    try {
      const snap = await col("tenants").where("slug", "==", slug).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0]!;
        return { id: doc.id, ...doc.data() } as TenantDoc;
      }
      const id = docId();
      const tenant: TenantDoc = { id, name, slug, createdAt: new Date().toISOString() };
      await col("tenants").doc(id).set(tenant);
      return tenant;
    } catch (err) {
      console.warn("[db] Firestore tenants failed, using in-memory:", String(err).slice(0, 120));
    }
  }

  const store = memCol("tenants");
  const existing = Object.values(store).find((t: any) => t.slug === slug) as TenantDoc | undefined;
  if (existing) return existing;
  const id = docId();
  const tenant: TenantDoc = { id, name, slug, createdAt: new Date().toISOString() };
  store[id] = tenant;
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
  if (useFirestore()) {
    try {
      const doc = await col("users").doc(uid).get();
      if (doc.exists) return { id: doc.id, ...doc.data() } as UserDoc;

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
    } catch (err) {
      console.warn("[db] Firestore users failed, using in-memory:", String(err).slice(0, 120));
    }
  }

  const store = memCol("users");
  if (store[uid]) return store[uid] as UserDoc;
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
  store[uid] = user;
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
  const mission: MissionDoc = { ...data, id, createdAt: new Date().toISOString() };

  if (useFirestore()) {
    try {
      await col("missions").doc(id).set(mission);
      return mission;
    } catch (err) {
      console.warn("[db] Firestore missions.create failed, using in-memory:", String(err).slice(0, 120));
    }
  }
  memCol("missions")[id] = mission;
  return mission;
}

export async function getMission(id: string): Promise<MissionDoc | null> {
  if (useFirestore()) {
    try {
      const doc = await col("missions").doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as MissionDoc;
    } catch (err) {
      console.warn("[db] Firestore missions.get failed:", String(err).slice(0, 120));
    }
  }
  return (memCol("missions")[id] as MissionDoc) ?? null;
}

export async function updateMission(id: string, data: Partial<MissionDoc>): Promise<void> {
  if (useFirestore()) {
    try {
      await col("missions").doc(id).update(data);
      return;
    } catch (err) {
      console.warn("[db] Firestore missions.update failed:", String(err).slice(0, 120));
    }
  }
  const existing = memCol("missions")[id];
  if (existing) Object.assign(existing, data);
}

export async function listMissions(tenantId: string, limit = 50): Promise<MissionDoc[]> {
  if (useFirestore()) {
    try {
      const snap = await col("missions")
        .where("tenantId", "==", tenantId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MissionDoc));
    } catch (err) {
      console.warn("[db] Firestore missions.list failed:", String(err).slice(0, 120));
    }
  }
  return Object.values(memCol("missions"))
    .filter((m: any) => m.tenantId === tenantId)
    .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit) as MissionDoc[];
}

export async function deleteMission(id: string): Promise<void> {
  if (useFirestore()) {
    try {
      const batch = adminDb.batch();
      const runsSnap = await col("executionRuns").where("missionId", "==", id).get();
      for (const run of runsSnap.docs) {
        const nodesSnap = await col("executionNodes").where("runId", "==", run.id).get();
        for (const node of nodesSnap.docs) batch.delete(node.ref);
        batch.delete(run.ref);
      }
      for (const c of ["problemProfiles", "routingDecisions", "evaluations", "decisionLedger"]) {
        const snap = await col(c).where("missionId", "==", id).get();
        for (const d of snap.docs) batch.delete(d.ref);
      }
      batch.delete(col("missions").doc(id));
      await batch.commit();
      return;
    } catch (err) {
      console.warn("[db] Firestore missions.delete failed:", String(err).slice(0, 120));
    }
  }
  for (const runId of Object.keys(memCol("executionRuns")).filter(k => (memCol("executionRuns")[k] as any)?.missionId === id)) {
    delete memCol("executionNodes")[runId];
  }
  for (const c of ["executionRuns", "problemProfiles", "routingDecisions", "evaluations", "decisionLedger"]) {
    for (const [k, v] of Object.entries(memCol(c))) {
      if ((v as any)?.missionId === id) delete memCol(c)[k];
    }
  }
  delete memCol("missions")[id];
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
  if (useFirestore()) {
    try {
      await col("problemProfiles").doc(id).set(doc);
      return doc;
    } catch (err) {
      console.warn("[db] Firestore problemProfiles.create failed:", String(err).slice(0, 120));
    }
  }
  memCol("problemProfiles")[id] = doc;
  return doc;
}

export async function getProblemProfile(missionId: string): Promise<ProblemProfileDoc | null> {
  if (useFirestore()) {
    try {
      const snap = await col("problemProfiles").where("missionId", "==", missionId).limit(1).get();
      if (snap.empty) return null;
      const d = snap.docs[0]!;
      return { id: d.id, ...d.data() } as ProblemProfileDoc;
    } catch (err) {
      console.warn("[db] Firestore problemProfiles.get failed:", String(err).slice(0, 120));
    }
  }
  return Object.values(memCol("problemProfiles")).find((p: any) => p.missionId === missionId) as ProblemProfileDoc ?? null;
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
  if (useFirestore()) {
    try {
      await col("routingDecisions").doc(id).set(doc);
      return doc;
    } catch (err) {
      console.warn("[db] Firestore routingDecisions.create failed:", String(err).slice(0, 120));
    }
  }
  memCol("routingDecisions")[id] = doc;
  return doc;
}

export async function getRoutingDecision(missionId: string): Promise<RoutingDecisionDoc | null> {
  if (useFirestore()) {
    try {
      const snap = await col("routingDecisions").where("missionId", "==", missionId).limit(1).get();
      if (snap.empty) return null;
      const d = snap.docs[0]!;
      return { id: d.id, ...d.data() } as RoutingDecisionDoc;
    } catch (err) {
      console.warn("[db] Firestore routingDecisions.get failed:", String(err).slice(0, 120));
    }
  }
  return Object.values(memCol("routingDecisions")).find((r: any) => r.missionId === missionId) as RoutingDecisionDoc ?? null;
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
    id, missionId, status: "running",
    totalCost: 0, totalTokens: 0, totalLatencyMs: 0,
    startedAt: new Date().toISOString(), completedAt: null,
  };
  if (useFirestore()) {
    try {
      await col("executionRuns").doc(id).set(run);
      return run;
    } catch (err) {
      console.warn("[db] Firestore executionRuns.create failed:", String(err).slice(0, 120));
    }
  }
  memCol("executionRuns")[id] = run;
  return run;
}

export async function updateExecutionRun(id: string, data: Partial<ExecutionRunDoc>): Promise<void> {
  if (useFirestore()) {
    try {
      await col("executionRuns").doc(id).update(data);
      return;
    } catch (err) {
      console.warn("[db] Firestore executionRuns.update failed:", String(err).slice(0, 120));
    }
  }
  const existing = memCol("executionRuns")[id];
  if (existing) Object.assign(existing, data);
}

export async function getExecutionRuns(missionId: string): Promise<ExecutionRunDoc[]> {
  if (useFirestore()) {
    try {
      const snap = await col("executionRuns").where("missionId", "==", missionId).get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ExecutionRunDoc));
    } catch (err) {
      console.warn("[db] Firestore executionRuns.get failed:", String(err).slice(0, 120));
    }
  }
  return Object.values(memCol("executionRuns")).filter((r: any) => r.missionId === missionId) as ExecutionRunDoc[];
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
  if (useFirestore()) {
    try {
      await col("executionNodes").doc(id).set(node);
      return node;
    } catch (err) {
      console.warn("[db] Firestore executionNodes.create failed:", String(err).slice(0, 120));
    }
  }
  memCol("executionNodes")[id] = node;
  return node;
}

export async function updateExecutionNode(id: string, data: Partial<ExecutionNodeDoc>): Promise<void> {
  if (useFirestore()) {
    try {
      await col("executionNodes").doc(id).update(data);
      return;
    } catch (err) {
      console.warn("[db] Firestore executionNodes.update failed:", String(err).slice(0, 120));
    }
  }
  const existing = memCol("executionNodes")[id];
  if (existing) Object.assign(existing, data);
}

export async function getExecutionNodes(runId: string): Promise<ExecutionNodeDoc[]> {
  if (useFirestore()) {
    try {
      const snap = await col("executionNodes").where("runId", "==", runId).get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ExecutionNodeDoc));
    } catch (err) {
      console.warn("[db] Firestore executionNodes.get failed:", String(err).slice(0, 120));
    }
  }
  return Object.values(memCol("executionNodes")).filter((n: any) => n.runId === runId) as ExecutionNodeDoc[];
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
  if (useFirestore()) {
    try {
      await col("evaluations").doc(id).set(doc);
      return doc;
    } catch (err) {
      console.warn("[db] Firestore evaluations.create failed:", String(err).slice(0, 120));
    }
  }
  memCol("evaluations")[id] = doc;
  return doc;
}

export async function getEvaluation(missionId: string): Promise<EvaluationDoc | null> {
  if (useFirestore()) {
    try {
      const snap = await col("evaluations").where("missionId", "==", missionId).limit(1).get();
      if (snap.empty) return null;
      const d = snap.docs[0]!;
      return { id: d.id, ...d.data() } as EvaluationDoc;
    } catch (err) {
      console.warn("[db] Firestore evaluations.get failed:", String(err).slice(0, 120));
    }
  }
  return Object.values(memCol("evaluations")).find((e: any) => e.missionId === missionId) as EvaluationDoc ?? null;
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
  if (useFirestore()) {
    try {
      await col("decisionLedger").doc(id).set(doc);
      return doc;
    } catch (err) {
      console.warn("[db] Firestore decisionLedger.create failed:", String(err).slice(0, 120));
    }
  }
  memCol("decisionLedger")[id] = doc;
  return doc;
}
