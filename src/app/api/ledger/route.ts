import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { decisionLedger } from "@/lib/drizzle/schema";
import { requireTenant } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireTenant();
  if (guard.error) return guard.error;
  try {
    const rows = await getDb()
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.tenantId, guard.ctx.tenantId))
      .orderBy(desc(decisionLedger.timestamp))
      .limit(50);
    return NextResponse.json({ live: true, items: rows });
  } catch {
    return NextResponse.json({ items: [], live: false });
  }
}
