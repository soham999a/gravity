import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { problemProfiles, missions } from "@/lib/drizzle/schema";
import { requireTenant } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  try {
    const rows = await getDb()
      .select({
        id: problemProfiles.id,
        missionId: problemProfiles.missionId,
        dataType: problemProfiles.dataType,
        complexity: problemProfiles.complexity,
        signals: problemProfiles.signals,
        dimensions: problemProfiles.dimensions,
        summary: problemProfiles.summary,
      })
      .from(problemProfiles)
      .innerJoin(missions, eq(problemProfiles.missionId, missions.id))
      .where(eq(missions.tenantId, guard.ctx.tenantId))
      .orderBy(desc(problemProfiles.id))
      .limit(50);
    return NextResponse.json({ live: true, items: rows });
  } catch {
    return NextResponse.json({ items: [], live: false });
  }
}
