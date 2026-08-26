import { NextResponse } from "next/server";
import { failStaleMissions } from "@/lib/gravity/pipeline";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await failStaleMissions();
  return NextResponse.json({ ok: true });
}
