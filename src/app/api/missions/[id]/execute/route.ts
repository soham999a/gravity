import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { verifyAuthToken } from "@/lib/api-auth";
import { executeMission } from "@/lib/gravity/pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Navigation-only request: do not 404. Returns a placeholder so the
  // client can present the execute panel without a full run.
  return NextResponse.json({ ok: true, missionId: id, status: "executing" });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await verifyAuthToken(_request as any);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;

  // Defer mission validation to the pipeline so a fresh serverless
  // instance (empty in-memory store) cannot 404 a mission that was
  // just created in a parallel invocation. executeMission() itself
  // calls getMission() and throws if the mission is genuinely missing.
  waitUntil(executeMission(id).catch((err) => {
    console.error(`[execute] mission ${id} failed:`, String(err).slice(0, 500));
  }));

  return NextResponse.json({ ok: true, missionId: id, status: "executing" });
}
