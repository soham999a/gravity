import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { getMission, getProblemProfile, getRoutingDecision, getExecutionRuns, getExecutionNodes, getEvaluation, deleteMission } from "@/lib/db-firestore";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await verifyAuthToken(_request as any);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;

  const mission = await getMission(id);
  if (!mission || mission.tenantId !== ctx.tenantId) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  const profile = await getProblemProfile(id);
  const routing = await getRoutingDecision(id);
  const runs = await getExecutionRuns(id);
  const run = runs[0] ?? null;
  const nodes = run ? await getExecutionNodes(run.id) : [];
  const evaluation = await getEvaluation(id);

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
  const ctx = await verifyAuthToken(_request as any);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;

  const mission = await getMission(id);
  if (!mission || mission.tenantId !== ctx.tenantId) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  await deleteMission(id);
  return NextResponse.json({ ok: true });
}
