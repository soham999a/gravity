import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agents } from "@/lib/drizzle/schema";
import { requireTenant } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  try {
    const rows = await getDb()
      .select()
      .from(agents)
      .where(eq(agents.tenantId, guard.ctx.tenantId))
      .orderBy(desc(agents.escalationLevel));
    return NextResponse.json({
      live: true,
      items: rows.map((a) => ({
        id: a.slug,
        name: a.name,
        agentClass: a.agentClass,
        escalation: a.escalationLevel,
        purpose: a.purpose ?? "",
        model: a.model ?? "—",
        tools: a.tools ?? [],
        reliability: Math.round((a.reliability ?? 0) * 100),
        status: a.status ?? "active",
      })),
    });
  } catch {
    return NextResponse.json({ items: [], live: false });
  }
}
