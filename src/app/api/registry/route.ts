import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tools, workflows } from "@/lib/drizzle/schema";
import { requireTenant } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  try {
    const db = getDb();
    const [toolRows, workflowRows] = await Promise.all([
      db.select().from(tools).where(eq(tools.tenantId, guard.ctx.tenantId)),
      db.select().from(workflows).where(eq(workflows.tenantId, guard.ctx.tenantId)),
    ]);
    return NextResponse.json({
      live: true,
      items: toolRows.map((t) => ({
        id: t.slug,
        name: t.name,
        type: t.type ?? "—",
        permissions: t.permissions ?? "—",
        latencyMs: t.latencyMs ?? 0,
        successRate: Math.round((t.successRate ?? 1) * 100),
        status: t.status ?? "active",
      })),
      workflows: workflowRows.map((w) => ({
        id: w.slug,
        name: w.name,
        description: w.description ?? "",
        steps: w.steps ?? [],
      })),
    });
  } catch {
    return NextResponse.json({ items: [], live: false });
  }
}
