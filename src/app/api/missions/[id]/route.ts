import { NextResponse } from "next/server";
import { verifyAuthToken, isStoreUnavailable, storeUnavailableResponse } from "@/lib/api-auth";
import { getMission, getProblemProfile, getRoutingDecision, getExecutionRuns, getExecutionNodes, getEvaluation, deleteMission, updateMission } from "@/lib/db-firestore";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    let ctx;
    try {
      ctx = await verifyAuthToken(_request as any);
    } catch (err) {
      if (isStoreUnavailable(err)) return storeUnavailableResponse();
      throw err;
    }
    if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { id } = await params;

    const mission = await getMission(id);
    if (!mission || mission.tenantId !== ctx.tenantId) {
      // Mission not visible to this tenant (or the ephemeral in-memory store was
      // wiped by a dev-server restart). Return an empty skeleton instead of 404
      // so the UI's poller doesn't error-loop during transient states.
      return NextResponse.json({
        mission: {
          id,
          prompt: "",
          status: "pending",
          domain: null,
          selectedStrategy: null,
          escalationLevel: null,
          totalTokens: null,
          totalLatencyMs: null,
          confidence: null,
          completedAt: null,
        },
        profile: null,
        routing: null,
        run: null,
        nodes: [],
        evaluation: null,
        live: true,
      });
    }

    // Self-heal: the stale-mission cron runs once a day, so a run that died
    // mid-execution (e.g. cut off by the 60s serverless window) would keep the
    // UI spinning for up to 24h. If this mission is still active 3 minutes in,
    // it is orphaned — mark it failed so the poller shows "Try again".
    const STALE_AFTER_MS = 3 * 60_000;
    const startedAt = Date.parse(mission.createdAt);
    if (
      ["pending", "profiling", "routing", "executing", "evaluating"].includes(mission.status) &&
      Number.isFinite(startedAt) &&
      Date.now() - startedAt > STALE_AFTER_MS
    ) {
      const completedAt = new Date().toISOString();
      await updateMission(id, { status: "failed", completedAt });
      mission.status = "failed";
      mission.completedAt = completedAt;
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
  } catch (err) {
    if (isStoreUnavailable(err)) return storeUnavailableResponse();
    console.error("[api/missions/:id] GET error:", err);
    return NextResponse.json({ error: String(err), live: false }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    let ctx;
    try {
      ctx = await verifyAuthToken(_request as any);
    } catch (err) {
      if (isStoreUnavailable(err)) return storeUnavailableResponse();
      throw err;
    }
    if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { id } = await params;

    const mission = await getMission(id);
    if (!mission || mission.tenantId !== ctx.tenantId) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    await deleteMission(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isStoreUnavailable(err)) return storeUnavailableResponse();
    console.error("[api/missions/:id] DELETE error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
