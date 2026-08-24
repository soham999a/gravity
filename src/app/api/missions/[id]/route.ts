import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import {
  missions,
  problemProfiles,
  routingDecisions,
  executionRuns,
  executionNodes,
  evaluations,
  decisionLedger,
} from "@/lib/drizzle/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "Database not configured", live: false }, { status: 503 });
  }
  const { id } = await params;
  const db = getDb();

  const [mission] = await db.select().from(missions).where(eq(missions.id, id));
  if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

  const [profile] = await db.select().from(problemProfiles).where(eq(problemProfiles.missionId, id));
  const [routing] = await db
    .select()
    .from(routingDecisions)
    .where(eq(routingDecisions.missionId, id));
  const runs = await db
    .select()
    .from(executionRuns)
    .where(eq(executionRuns.missionId, id))
    .orderBy(desc(executionRuns.startedAt));
  const run = runs[0] ?? null;
  const nodes = run
    ? await db.select().from(executionNodes).where(eq(executionNodes.runId, run.id))
    : [];
  const [evaluation] = await db.select().from(evaluations).where(eq(evaluations.missionId, id));

  return NextResponse.json({
    mission,
    profile: profile ?? null,
    routing: routing ?? null,
    run,
    nodes,
    evaluation: evaluation ?? null,
    live: true,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "Database not configured", live: false }, { status: 503 });
  }
  const { id } = await params;
  const db = getDb();
  await db.delete(evaluations).where(eq(evaluations.missionId, id));
  await db.delete(decisionLedger).where(eq(decisionLedger.missionId, id));
  const runs = await db.select().from(executionRuns).where(eq(executionRuns.missionId, id));
  for (const run of runs) {
    await db.delete(executionNodes).where(eq(executionNodes.runId, run.id));
  }
  await db.delete(executionRuns).where(eq(executionRuns.missionId, id));
  await db.delete(routingDecisions).where(eq(routingDecisions.missionId, id));
  await db.delete(problemProfiles).where(eq(problemProfiles.missionId, id));
  await db.delete(missions).where(eq(missions.id, id));
  return NextResponse.json({ ok: true });
}
