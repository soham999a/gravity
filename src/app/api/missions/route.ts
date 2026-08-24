import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { missions } from "@/lib/drizzle/schema";
import { createMissionWithPlan } from "@/lib/gravity/pipeline";
import { requireTenant } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  try {
    const rows = await getDb()
      .select()
      .from(missions)
      .where(eq(missions.tenantId, guard.ctx.tenantId))
      .orderBy(desc(missions.createdAt))
      .limit(50);
    return NextResponse.json({ missions: rows, live: true });
  } catch {
    return NextResponse.json({ missions: [], live: false });
  }
}

export async function POST(request: Request) {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  try {
    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (prompt.length > 4000) {
      return NextResponse.json({ error: "prompt exceeds 4000 characters" }, { status: 413 });
    }

    const { mission, profile, routing } = await createMissionWithPlan(prompt, {
      tenantId: guard.ctx.tenantId,
      userId: guard.ctx.authUserId,
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
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
