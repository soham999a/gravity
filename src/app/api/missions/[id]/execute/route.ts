import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { missions } from "@/lib/drizzle/schema";
import { executeMission } from "@/lib/gravity/pipeline";
import { requireTenant } from "@/lib/api-auth";

// Mission pipelines chain multiple LLM calls (profiling, planning,
// specialist agents, critique). Keep the function alive until the
// background execution finishes (60s = Vercel Hobby maximum).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  const { id } = await params;
  const db = getDb();

  const [mission] = await db
    .select()
    .from(missions)
    .where(and(eq(missions.id, id), eq(missions.tenantId, guard.ctx.tenantId)));
  if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

  // Respond immediately; waitUntil keeps the serverless instance alive
  // (locally it simply runs the promise) while the client polls
  // GET /api/missions/[id] for live progress.
  waitUntil(executeMission(id));

  return NextResponse.json({ ok: true, missionId: id, status: "executing" });
}
