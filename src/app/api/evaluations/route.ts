import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import { evaluations, missions } from "@/lib/drizzle/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured) return NextResponse.json({ items: [], live: false });
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
      .leftJoin(missions, eq(evaluations.missionId, missions.id))
      .orderBy(desc(missions.createdAt))
      .limit(50);
    return NextResponse.json({ live: true, items: rows });
  } catch {
    return NextResponse.json({ items: [], live: false });
  }
}
