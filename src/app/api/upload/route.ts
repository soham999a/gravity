import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeFileName, validateCsv } from "@/lib/validate";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload — Accept CSV text, return an ID for the data.
 * Stores in-memory (keyed by random ID) for pipeline processing.
 */
const store = new Map<string, { csv: string; name: string; uploadedAt: number }>();

(globalThis as Record<string, unknown>).__csvStore = store;

export async function POST(request: Request) {
  try {
    const ctx = await verifyAuthToken(request as any);
    if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const rl = checkRateLimit(`upload:${rateLimitKey(request, ctx.uid)}`, 30, 10 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }

    const body = (await request.json()) as { csv?: string; fileName?: string };
    try {
      if (!body.csv) throw new Error("CSV data is too short or missing");
      const { rows } = validateCsv(body.csv);
      var rowCount = rows;
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "bad csv" }, { status: 400 });
    }
    let safeName = "uploaded.csv";
    try {
      safeName = sanitizeFileName(body.fileName ?? "uploaded.csv");
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "bad filename" }, { status: 400 });
    }

    const id = `csv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    store.set(id, {
      csv: body.csv,
      name: safeName,
      uploadedAt: Date.now(),
    });
    logger.info("upload", { uid: ctx.uid.slice(0, 6), bytes: body.csv.length });

    const cutoff = Date.now() - 30 * 60_000;
    for (const [key, val] of store) {
      if (val.uploadedAt < cutoff) store.delete(key);
    }

    return NextResponse.json({ id, rows: rowCount });
  } catch (err) {
    const { logger } = await import("@/lib/logger");
    logger.error("upload failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export function getUploadedCSV(id: string): { csv: string; name: string } | null {
  const entry = (globalThis as Record<string, unknown>).__csvStore as
    | Map<string, { csv: string; name: string; uploadedAt: number }>
    | undefined;
  return entry?.get(id) ?? null;
}
