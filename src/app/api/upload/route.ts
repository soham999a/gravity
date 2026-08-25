import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload — Accept CSV text, return an ID for the data.
 * For the demo, we store the CSV text in-memory (keyed by a random ID)
 * and the client passes it alongside the mission prompt.
 * 
 * In production this would be Supabase Storage or S3.
 */
const store = new Map<string, { csv: string; name: string; uploadedAt: number }>();

// Expose globally for the pipeline to read
(globalThis as Record<string, unknown>).__csvStore = store;

export async function POST(request: Request) {
  try {
    const guard = await requireTenant();
    if (guard.error) return guard.error;

    const body = (await request.json()) as { csv?: string; fileName?: string };
    if (!body.csv || body.csv.length < 10) {
      return NextResponse.json({ error: "CSV data is too short or missing" }, { status: 400 });
    }
    if (body.csv.length > 2_000_000) {
      return NextResponse.json({ error: "CSV exceeds 2 MB limit" }, { status: 413 });
    }

    const id = `csv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    store.set(id, {
      csv: body.csv,
      name: body.fileName ?? "uploaded.csv",
      uploadedAt: Date.now(),
    });

    // Cleanup entries older than 30 minutes
    const cutoff = Date.now() - 30 * 60_000;
    for (const [key, val] of store) {
      if (val.uploadedAt < cutoff) store.delete(key);
    }

    return NextResponse.json({ id, rows: body.csv.split("\n").length - 1 });
  } catch (err) {
    console.error("[api/upload] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** Retrieve uploaded CSV by ID. Returns null if not found or expired. */
export function getUploadedCSV(id: string): { csv: string; name: string } | null {
  const entry = (globalThis as Record<string, unknown>).__csvStore as
    | Map<string, { csv: string; name: string; uploadedAt: number }>
    | undefined;
  return entry?.get(id) ?? null;
}
