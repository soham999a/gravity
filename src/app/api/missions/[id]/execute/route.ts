import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import { missions } from "@/lib/drizzle/schema";
import { executeMission } from "@/lib/gravity/pipeline";

// Mission pipelines chain multiple LLM calls (profiling, planning,
// specialist agents, critique). Keep the function alive until the
// background execution finishes (60s = Vercel Hobby maximum).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
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

  // Respond immediately; waitUntil keeps the serverless instance alive
  // (locally it simply runs the promise) while the client polls
  // GET /api/missions/[id] for live progress.
  waitUntil(executeMission(id));

  return NextResponse.json({ ok: true, missionId: id, status: "executing" });
}
