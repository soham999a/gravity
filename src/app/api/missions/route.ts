import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import { missions } from "@/lib/drizzle/schema";
import { createMissionWithPlan } from "@/lib/gravity/pipeline";

export async function GET() {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "Database not configured", live: false }, { status: 503 });
  }
  const db = getDb();
  const rows = await db.select().from(missions).orderBy(desc(missions.createdAt)).limit(50);
  return NextResponse.json({ missions: rows, live: true });
}

export async function POST(request: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "Database not configured", live: false }, { status: 503 });
  }
  try {
    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const { mission, profile, routing } = await createMissionWithPlan(prompt);

    return NextResponse.json(
      {
        missionId: mission.id,
        profile,
        routing,
        live: true,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
