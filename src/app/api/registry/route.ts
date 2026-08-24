import { NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";
import { tools, workflows } from "@/lib/drizzle/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured) return NextResponse.json({ items: [], live: false });
  try {
    const db = getDb();
    const [toolRows, workflowRows] = await Promise.all([
      db.select().from(tools),
      db.select().from(workflows),
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
