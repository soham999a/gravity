import { NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  missions,
  problemProfiles,
  routingDecisions,
  executionRuns,
  executionNodes,
  evaluations,
  decisionLedger,
} from "@/lib/drizzle/schema";
import { requireTenant } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

async function loadOwnedMission(tenantId: string, id: string) {
  const [mission] = await getDb()
    .select()
    .from(missions)
    .where(and(eq(missions.id, id), eq(missions.tenantId, tenantId)));
  return mission ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  const { id } = await params;
  const db = getDb();

  const mission = await loadOwnedMission(guard.ctx.tenantId, id);
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
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  const { id } = await params;
  const db = getDb();

  const mission = await loadOwnedMission(guard.ctx.tenantId, id);
  if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

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
