import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evaluations, missions } from "@/lib/drizzle/schema";
import { requireTenant } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  try {
    const rows = await getDb()
      .select({
        id: evaluations.id,
        missionId: evaluations.missionId,
        prompt: missions.prompt,
        dimensions: evaluations.dimensions,
        qualityScore: evaluations.qualityScore,
        outputVerdict: evaluations.outputVerdict,
        decisionVerdict: evaluations.decisionVerdict,
        feedback: evaluations.feedback,
      })
      .from(evaluations)
      .innerJoin(missions, eq(evaluations.missionId, missions.id))
      .where(eq(missions.tenantId, guard.ctx.tenantId))
      .orderBy(desc(missions.createdAt))
      .limit(50);
    return NextResponse.json({ live: true, items: rows });
  } catch {
    return NextResponse.json({ items: [], live: false });
  }
}
