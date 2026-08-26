import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { verifyAuthToken } from "@/lib/api-auth";
import { getMission } from "@/lib/db-firestore";
import { executeMission } from "@/lib/gravity/pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
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

  // Respond immediately; waitUntil keeps the serverless instance alive
  // while the client polls GET /api/missions/[id] for live progress.
  waitUntil(executeMission(id));

  return NextResponse.json({ ok: true, missionId: id, status: "executing" });
}
