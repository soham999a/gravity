import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { createMission, listMissions } from "@/lib/db-firestore";
import { createMissionWithPlan } from "@/lib/gravity/pipeline";

export const dynamic = "force-dynamic";

interface CsvFile {
  data: string;
  name: string;
}

export async function GET(request: Request) {
  try {
    const ctx = await verifyAuthToken(request as any);
    if (!ctx) {
      return NextResponse.json({ error: "unauthenticated", live: false }, { status: 401 });
    }
    const rows = await listMissions(ctx.tenantId);
    return NextResponse.json({ missions: rows, live: true });
  } catch (err) {
    console.error("[api/missions] GET error:", err);
    return NextResponse.json({ missions: [], live: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await verifyAuthToken(request as any);
    if (!ctx) {
      return NextResponse.json({ error: "unauthenticated", live: false }, { status: 401 });
    }

    const body = (await request.json()) as { prompt?: string; files?: CsvFile[] };
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (prompt.length > 4000) {
      return NextResponse.json({ error: "prompt exceeds 4000 characters" }, { status: 413 });
    }

    const { mission, profile, routing } = await createMissionWithPlan(prompt, {
      tenantId: ctx.tenantId,
      userId: ctx.uid,
      files: body.files,
    });

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
    console.error("[api/missions] POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
