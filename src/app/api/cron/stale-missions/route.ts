import { NextResponse } from "next/server";
import { failStaleMissions } from "@/lib/gravity/pipeline";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const before = Date.now();
  const fixed = await failStaleMissions();
  const took = Date.now() - before;

  if (took > 5_000) {
    console.warn(
      `[cron/stale-missions] took ${took}ms and fixed ${fixed} mission(s) — stuck missions should normally `
      + `be caught by the per-mission poll self-heal (3 min) before the cron runs; `
      + `a slow cron usually means the in-memory store was wiped and Firestore is `
      + `being scanned. Not an error, just worth watching.`,
    );
  }

  return NextResponse.json({ ok: true, fixed, took });
}
