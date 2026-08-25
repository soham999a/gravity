import { NextResponse } from "next/server";
import { inArray, lt, and } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import { missions } from "@/lib/drizzle/schema";

export const dynamic = "force-dynamic";

const STALE_MS = 4 * 60 * 1000;
const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  const db = getDb();
  const staleCutoff = new Date(Date.now() - STALE_MS);

  const rows = await db
    .select({ id: missions.id })
    .from(missions)
    .where(
      and(
        inArray(missions.status, ["pending", "profiling", "routing", "executing", "evaluating"]),
        lt(missions.createdAt, staleCutoff)
      )
    );

  if (rows.length === 0) {
    return NextResponse.json({ fixed: 0 });
  }

  await db
    .update(missions)
    .set({ status: "failed" })
    .where(inArray(missions.id, rows.map((r) => r.id)));

  return NextResponse.json({ fixed: rows.length });
}
