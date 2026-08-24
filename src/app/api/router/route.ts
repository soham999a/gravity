import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { routingDecisions, missions } from "@/lib/drizzle/schema";
import { requireTenant } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  try {
    const rows = await getDb()
      .select({
        id: routingDecisions.id,
        missionId: routingDecisions.missionId,
        candidates: routingDecisions.candidates,
        selectedStrategy: routingDecisions.selectedStrategy,
        escalationLevel: routingDecisions.escalationLevel,
        voiScore: routingDecisions.voiScore,
        confidence: routingDecisions.confidence,
        reasoning: routingDecisions.reasoning,
        estimatedTokens: routingDecisions.estimatedTokens,
        maxTokens: routingDecisions.maxTokens,
      })
      .from(routingDecisions)
      .innerJoin(missions, eq(routingDecisions.missionId, missions.id))
      .where(eq(missions.tenantId, guard.ctx.tenantId))
      .orderBy(desc(routingDecisions.confidence))
      .limit(50);
    return NextResponse.json({ live: true, items: rows });
  } catch {
    return NextResponse.json({ items: [], live: false });
  }
}
