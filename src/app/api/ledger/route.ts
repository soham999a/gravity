import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import { decisionLedger } from "@/lib/drizzle/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured) return NextResponse.json({ items: [], live: false });
  try {
    const rows = await getDb()
      .select()
      .from(decisionLedger)
      .orderBy(desc(decisionLedger.timestamp))
      .limit(50);
    return NextResponse.json({ live: true, items: rows });
  } catch {
    return NextResponse.json({ items: [], live: false });
  }
}
