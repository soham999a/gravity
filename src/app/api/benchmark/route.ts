import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { runBenchmark, recordsToCsv, GROUND_TRUTH, type RunnerProgress } from "@/lib/gravity/benchmarkRunner";
import {
  getLatestBenchmark,
  saveBenchmarkRun,
} from "@/lib/gravity/benchmarkStore";
import type { BenchmarkSystem } from "@/lib/gravity/benchmarkTypes";

export const maxDuration = 120; // matches the proven classes-route ceiling on Vercel
export const dynamic = "force-dynamic";

const VALID_SYSTEMS: BenchmarkSystem[] = [
  "GRAVITY",
  "GRAVITY-STATIC",
  "GRAVITY-OPENROUTER",
  "JEV",
  "CLAUDE",
  "OPENAI",
];

/** Latest run (manifest + records + aggregates) for the /benchmark page. */
export async function GET(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  if (searchParams.get("format") === "csv") {
    const { records } = await getLatestBenchmark();
    return new NextResponse(recordsToCsv(records), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gravity-benchmark-${Date.now()}.csv"`,
      },
    });
  }

  const latest = await getLatestBenchmark();
  return NextResponse.json({
    ...latest,
    groundTruth: Object.entries(GROUND_TRUTH).map(([classId, truth]) => ({
      classId,
      difficulty: truth.difficulty,
      successCriterion: truth.successCriterion,
    })),
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
  });
}

/**
 * Run the harness SERVER-SIDE — the spec's core demand. The backend executes
 * every (task, system) pair and emits BenchmarkRecords into the store.
 * Body: { systems?: BenchmarkSystem[], classes?: string[], runsPerClass?: number, seed?: number }
 */
export async function POST(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { checkRateLimit, rateLimitKey } = await import("@/lib/rate-limit");
  const rl = checkRateLimit(`benchmark:${rateLimitKey(request, ctx.uid)}`, 5, 60 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "benchmark rate limited — 5/hour" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    systems?: string[];
    classes?: string[];
    runsPerClass?: number;
    seed?: number;
  };

  const systems = (body.systems ?? []).filter((system): system is BenchmarkSystem =>
    VALID_SYSTEMS.includes(system as BenchmarkSystem),
  );
  if (systems.length === 0) {
    return NextResponse.json(
      { error: "pick at least one system: GRAVITY, GRAVITY-STATIC, CLAUDE, OPENAI" },
      { status: 400 },
    );
  }

  // JEV needs its own engine — not runnable through this harness yet.
  if (systems.includes("JEV")) {
    return NextResponse.json(
      {
        error:
          "JEV is declared in the schema but not wired into this runner yet — run GRAVITY, GRAVITY-STATIC, GRAVITY-OPENROUTER, CLAUDE, OPENAI.",
      },
      { status: 400 },
    );
  }

  const classes = (body.classes ?? ["A", "B", "C", "D", "E"]).filter((entry) =>
    ["A", "B", "C", "D", "E"].includes(entry),
  ) as ("A" | "B" | "C" | "D" | "E")[];
  const runsPerClass = Math.min(Math.max(body.runsPerClass ?? 1, 1), 3);
  const seed = typeof body.seed === "number" ? body.seed : 42;

  const progress: RunnerProgress[] = [];
  try {
    const result = await runBenchmark({
      systems,
      classes,
      runsPerClass,
      seed,
      onProgress: (p) => {
        progress.push(p);
        console.log(`[benchmark] ${p.current}/${p.total} ${p.label}`);
      },
    });
    const persisted = await saveBenchmarkRun(result.manifest, result.records);
    return NextResponse.json({
      ...result,
      ...persisted,
      progress,
    });
  } catch (err) {
    console.error("[benchmark] run failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Benchmark run failed" },
      { status: 500 },
    );
  }
}
