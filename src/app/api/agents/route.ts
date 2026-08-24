import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import { agents } from "@/lib/drizzle/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured) return NextResponse.json({ items: [], live: false });
  try {
    const rows = await getDb().select().from(agents).orderBy(desc(agents.escalationLevel));
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
