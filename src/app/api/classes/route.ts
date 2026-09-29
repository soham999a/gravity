import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { runWorkloadClass, WORKLOAD_CLASSES } from "@/lib/gravity/classes";
import type { WorkloadClassId } from "@/lib/gravity/classes";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Metadata for the battery UI. */
export async function GET() {
  return NextResponse.json({
    classes: WORKLOAD_CLASSES.map((def) => ({
      id: def.id,
      title: def.title,
      examples: def.examples,
      claim: def.claim,
      expect: def.expect,
    })),
  });
}

/** Run one class — the heavy endpoint (live pipeline + model calls). */
export async function POST(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { classId?: string };
  const def = WORKLOAD_CLASSES.find((entry) => entry.id === body.classId);
  if (!def) {
    return NextResponse.json({ error: "unknown classId" }, { status: 400 });
  }

  try {
    const receipt = await runWorkloadClass(def);
    return NextResponse.json({ receipt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Class run failed" },
      { status: 500 },
    );
  }
}
