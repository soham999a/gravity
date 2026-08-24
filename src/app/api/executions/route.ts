import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import { executionRuns, executionNodes, missions } from "@/lib/drizzle/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured) return NextResponse.json({ items: [], live: false });
  try {
    const db = getDb();
    const runs = await db
      .select({
        id: executionRuns.id,
        missionId: executionRuns.missionId,
        status: executionRuns.status,
        totalCost: executionRuns.totalCost,
        totalTokens: executionRuns.totalTokens,
        totalLatencyMs: executionRuns.totalLatencyMs,
        startedAt: executionRuns.startedAt,
        completedAt: executionRuns.completedAt,
        prompt: missions.prompt,
      })
      .from(executionRuns)
      .leftJoin(missions, eq(executionRuns.missionId, missions.id))
      .orderBy(desc(executionRuns.startedAt))
      .limit(8);

    const nodeRows = await db.select().from(executionNodes).orderBy(executionNodes.startTime);

    return NextResponse.json({
      live: true,
      items: runs.map((r) => ({
        ...r,
        nodes: nodeRows
          .filter((n) => n.runId === r.id)
          .map((n) => ({
            id: n.id,
            name: n.name,
            type: n.type,
            status: n.status,
            stage: n.stage ?? "Execution",
            purpose: n.purpose ?? "",
            cost: n.cost ?? 0,
            tokens: n.tokens ?? 0,
            latencyMs: n.latencyMs ?? 0,
            confidence: n.confidence ?? 0,
          })),
      })),
    });
  } catch {
    return NextResponse.json({ items: [], live: false });
  }
}
