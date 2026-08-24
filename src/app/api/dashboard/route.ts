import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import {
  evaluations,
  missions,
  routingDecisions,
  problemProfiles,
  executionRuns,
  executionNodes,
  decisionLedger,
} from "@/lib/drizzle/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured) return NextResponse.json({ live: false });
  try {
    const db = getDb();

    const [missionRows, evalRows, ledgerRows] = await Promise.all([
      db.select().from(missions).orderBy(desc(missions.createdAt)).limit(200),
      db.select().from(evaluations).orderBy(desc(evaluations.missionId)).limit(200),
      db.select().from(decisionLedger).orderBy(desc(decisionLedger.timestamp)).limit(200),
    ]);

    const completed = missionRows.filter((m) => m.status === "completed");
    const totalTokens = missionRows.reduce((s, m) => s + (m.totalTokens ?? 0), 0);
    const avgQuality =
      evalRows.length > 0
        ? evalRows.reduce((s, e) => s + (e.qualityScore ?? 0), 0) / evalRows.length
        : 0;
    const noLlm = ledgerRows.filter((l) => (l.llmCalls ?? 0) === 0).length;

    const strategyCounts: Record<string, number> = {};
    for (const m of missionRows) {
      if (m.selectedStrategy) strategyCounts[m.selectedStrategy] = (strategyCounts[m.selectedStrategy] ?? 0) + 1;
    }

    const recent = await Promise.all(
      missionRows.slice(0, 6).map(async (m) => {
        const [rd] = await db
          .select()
          .from(routingDecisions)
          .where(eq(routingDecisions.missionId, m.id))
          .limit(1);
        const [pp] = await db
          .select()
          .from(problemProfiles)
          .where(eq(problemProfiles.missionId, m.id))
          .limit(1);
        return {
          id: m.id,
          prompt: m.prompt,
          strategy: m.selectedStrategy ?? rd?.selectedStrategy ?? "—",
          complexity: pp?.complexity ?? "—",
          cost: `$${(m.totalCost ?? 0).toFixed(2)}`,
          tokens: m.totalTokens ?? 0,
          latencyMs: m.totalLatencyMs ?? 0,
          confidence: Math.round(((m.confidence ?? rd?.confidence ?? 0) as number) * 100),
          status: m.status,
          createdAt: m.createdAt,
        };
      }),
    );

    const runs = await db.select().from(executionRuns).orderBy(desc(executionRuns.startedAt)).limit(5);
    const nodeRows = runs.length
      ? await db.select().from(executionNodes).limit(500)
      : [];

    return NextResponse.json({
      live: true,
      kpis: {
        successRate: missionRows.length > 0 ? completed.length / missionRows.length : 0,
        avgQuality,
        costPerTask: 0,
        noLlmShare: ledgerRows.length > 0 ? noLlm / ledgerRows.length : 0,
        totalMissions: missionRows.length,
        totalTokens,
      },
      strategyCounts,
      recent,
      executions: runs.map((r) => ({
        id: r.id,
        missionId: r.missionId,
        status: r.status,
        tokens: r.totalTokens ?? 0,
        latencyMs: r.totalLatencyMs ?? 0,
        nodes: nodeRows.filter((n) => n.runId === r.id).length,
      })),
    });
  } catch {
    return NextResponse.json({ live: false });
  }
}
