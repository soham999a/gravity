import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { runBenchmark, recordsToCsv, type RunnerProgress } from "@/lib/gravity/benchmarkRunner";
import { GROUND_TRUTH } from "@/lib/gravity/benchmarkEval";
import { PINNED_CONFIG, JEV_WIRED } from "@/lib/gravity/benchmarkAdapters";
import { REPRODUCIBILITY_NOTE } from "@/lib/gravity/benchmarkTypes";
import {
  getBenchmarkRun,
  getLatestBenchmark,
  listBenchmarkRuns,
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
  // Run history for A/B compare: ?runs=list → manifests (latest 20).
  if (searchParams.get("runs") === "list") {
    const runs = await listBenchmarkRuns(20);
    return NextResponse.json({
      runs: runs.map((m) => ({
        runId: m.runId,
        seed: m.seed,
        startedAt: m.startedAt,
        taskVersion: m.taskVersion,
        systems: m.systems,
        workloadClasses: m.workloadClasses,
        runsPerClass: m.runsPerClass,
        recordCount: m.recordCount,
      })),
    });
  }
  // ?runId=xxx → that exact run (manifest + records + aggregates).
  const runId = searchParams.get("runId");
  if (runId) {
    const run = await getBenchmarkRun(runId);
    if (!run.manifest) {
      return NextResponse.json({ error: "unknown runId" }, { status: 404 });
    }
    return NextResponse.json({
      ...run,
      taskSet: "workload-classes",
      reproducibility: REPRODUCIBILITY_NOTE,
    });
  }
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
    taskSet: "workload-classes",
    reproducibility: REPRODUCIBILITY_NOTE,
    groundTruth: Object.entries(GROUND_TRUTH).map(([classId, truth]) => ({
      classId,
      difficulty: truth.difficulty,
      successCriterion: truth.successCriterion,
    })),
    pinnedConfig: {
      claudeModel: PINNED_CONFIG.CLAUDE_MODEL,
      openaiModel: PINNED_CONFIG.OPENAI_MODEL,
      openrouterModel: PINNED_CONFIG.OPENROUTER_MODEL,
      temperature: PINNED_CONFIG.TEMPERATURE,
      maxTokens: PINNED_CONFIG.MAX_TOKENS,
    },
    jevWired: JEV_WIRED,
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
    /** Append mode: chunk of a larger run — reuses this runId. */
    runId?: string;
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

  // JEV stays selectable: the adapter records the honest UNSUPPORTED error
  // (spec: a missing row is worse than a failed row) instead of 400-ing.

  const classes = (body.classes ?? ["A", "B", "C", "D", "E"]).filter((entry) =>
    ["A", "B", "C", "D", "E"].includes(entry),
  ) as ("A" | "B" | "C" | "D" | "E")[];
  const runsPerClass = Math.min(Math.max(body.runsPerClass ?? 1, 1), 10);
  const seed = typeof body.seed === "number" ? body.seed : 42;
  const appendRunId = typeof body.runId === "string" && body.runId.length > 0 ? body.runId : undefined;

  // Chunk guard: one request stays Vercel-safe (≤8 combos ≈ under 120s).
  // The client chains chunks with a shared runId; the run total caps at 60.
  const combos = systems.length * classes.length * runsPerClass;
  if (combos > 8) {
    return NextResponse.json(
      { error: `Chunk too large: ${combos} combos. Max 8 per request — the Lab splits runs into chunks automatically.` },
      { status: 400 },
    );
  }
  if (classes.length === 0) {
    return NextResponse.json({ error: "pick at least one class: A, B, C, D, E" }, { status: 400 });
  }
  if (appendRunId) {
    const existing = await getBenchmarkRun(appendRunId);
    const total = (existing.manifest?.recordCount ?? 0) + combos;
    if (total > 60) {
      return NextResponse.json(
        { error: `Run would reach ${total} combos (max 60 per run). Start a fresh run.` },
        { status: 400 },
      );
    }
  }

  const wantSSE = (request.headers.get("accept") ?? "").includes("text/event-stream");
  const progress: RunnerProgress[] = [];
  const logProgress = (p: RunnerProgress) => {
    progress.push(p);
    console.log(`[benchmark] ${p.current}/${p.total} ${p.label}`);
  };

  if (!wantSSE) {
    try {
      const payload = await runBenchmark({
        systems,
        classes,
        runsPerClass,
        seed,
        runId: appendRunId,
        signal: request.signal,
        onProgress: logProgress,
      }).then(async (result) => {
        const persisted = await saveBenchmarkRun(result.manifest, result.records);
        return { ...result, ...persisted, progress };
      });
      return NextResponse.json(payload);
    } catch (err) {
      console.error("[benchmark] run failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Benchmark run failed" },
        { status: 500 },
      );
    }
  }

  // SSE transport: the run executes INSIDE the stream so progress events are
  // truly live. Persist-before-final keeps disconnects safe; errors arrive as
  // {type:"error"} since headers are already sent.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* client gone */
        }
      };
      try {
        const result = await runBenchmark({
          systems,
          classes,
          runsPerClass,
          seed,
          runId: appendRunId,
          signal: request.signal,
          onProgress: (p) => {
            logProgress(p);
            send({ type: "progress", ...p });
          },
        });
        const persisted = await saveBenchmarkRun(result.manifest, result.records);
        send({ type: "result", ...result, ...persisted, progress });
      } catch (err) {
        console.error("[benchmark] run failed:", err);
        send({ type: "error", error: err instanceof Error ? err.message : "Benchmark run failed" });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      // Client STOP → request.signal aborts → runner discards the queue.
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
