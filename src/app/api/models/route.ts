import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { models } from "@/lib/drizzle/schema";
import { requireTenant } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  try {
    const rows = await getDb()
      .select()
      .from(models)
      .where(eq(models.tenantId, guard.ctx.tenantId))
      .orderBy(desc(models.quality));
    return NextResponse.json({
      live: true,
      items: rows.map((m, i) => ({
        id: `M${String(i + 1).padStart(3, "0")}`,
        name: m.name,
        provider: m.provider ?? "—",
        capability: m.capability ?? "—",
        costPerToken: m.costPerToken ?? 0,
        latencyMs: m.latencyMs ?? 0,
        contextWindow: m.contextWindow ?? 0,
        quality: Math.round((m.quality ?? 0) * 100),
        placement: m.placement ?? "cloud",
        status: m.status ?? "active",
      })),
    });
  } catch {
    return NextResponse.json({ items: [], live: false });
  }
}
