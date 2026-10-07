"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  LoaderCircle,
  Monitor,
  RotateCcw,
  Smartphone,
  Tablet,
  Wand2,
} from "lucide-react";
import {
  AutoCharts,
  buildExportMarkdown,
  detectSeries,
  EngineTrace,
  HeroStatsStrip,
  JuryScorecard,
  SectionedBrief,
  type HeroStats,
  type TraceNode,
} from "@/components/studio/ResultPortal";
import { ResultWindow } from "./ResultWindow";
import { ComparePanel, type CompareWith } from "./ComparePanel";
import { displayPrompt, stripDataMarkers } from "@/lib/gravity/promptText";
import { downloadImageFile } from "@/lib/utils";

interface MissionData {
  mission: {
    id: string;
    prompt: string;
    status: string;
    domain: string | null;
    selectedStrategy: string | null;
    escalationLevel: number | string | null;
    confidence: number | null;
    totalTokens: number | null;
    totalLatencyMs: number | null;
    createdAt: string | null;
    completedAt: string | null;
  };
  profile: {
    dataType: string | null;
    complexity: string | null;
    summary: string | null;
  } | null;
  routing: {
    candidates: { name: string; suitabilityScore: number; strategy: string }[] | null;
    selectedStrategy: string | null;
    reasoning: string | null;
  } | null;
  nodes: {
    id: string;
    name: string | null;
    stage: string | null;
    purpose: string | null;
    status: string | null;
    output: string | null;
    tokens: number | null;
    latencyMs: number | null;
  }[];
  evaluation: {
    qualityScore: number | null;
    dimensions: { name: string; score: number }[] | null;
    feedback: string | null;
    outputVerdict?: string | null;
  } | null;
  run: {
    status: string;
    totalCost: number;
    totalTokens: number;
    totalLatencyMs: number;
  } | null;
}

const ACTIVE = ["pending", "profiling", "routing", "executing", "evaluating"];

const STEPS = [
  { label: "UNDERSTANDING", detail: "Reading your intent and the shape of the problem" },
  { label: "ROUTING", detail: "Selecting the least complex sufficient intelligence" },
  { label: "EXECUTING", detail: "Assembling workers and running the path" },
  { label: "REVIEW", detail: "Judging the result before you see it" },
  { label: "COMPLETE", detail: "Ready for you" },
];

const STATUS_INDEX: Record<string, number> = {
  pending: 0,
  profiling: 0,
  routing: 1,
  executing: 2,
  evaluating: 3,
  completed: 4,
};

function titleFromPrompt(prompt: string): string {
  // Titles come from the stored prompt, which may embed uploaded files as
  // [DATA:csv] blocks — those must never appear in a title.
  const clean = stripDataMarkers(prompt).replace(/\s+/g, " ").trim();
  return clean.length > 64 ? `${clean.slice(0, 61)}…` : clean || "A considered response";
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function MissionRun({
  missionId,
  onFollowUp,
  onRetry,
  onStatus,
  onSimulate,
  compareWith,
}: {
  missionId: string;
  /** Runs a refinement as a brand-new task seeded with the original context. */
  onFollowUp?: (refinement: string) => Promise<void>;
  /** Re-executes this same mission after a failure. */
  onRetry?: () => Promise<void>;
  /** Receives the live mission status on every poll tick (pending → … → completed/failed). */
  onStatus?: (status: string) => void;
  /** User Control simulation: re-runs this task through the given strategy
   *  (null = let the kernel decide again). */
  onSimulate?: (strategy: string | null) => Promise<void>;
  /** Side-by-side compare against the run this was simulated from (or spawned). */
  compareWith?: CompareWith | null;
}) {
  const [data, setData] = React.useState<MissionData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [howOpen, setHowOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [refinement, setRefinement] = React.useState("");
  const [followBusy, setFollowBusy] = React.useState(false);
  const [retryBusy, setRetryBusy] = React.useState(false);
  const onStatusRef = React.useRef(onStatus);
  React.useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/missions/${missionId}`, { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = (await res.json()) as MissionData;
        if (cancelled) return;
        setData(json);
        setError(null);
        onStatusRef.current?.(json.mission.status);
        if (ACTIVE.includes(json.mission.status)) {
          // Snappy first 15s (900ms), then back off to 1600ms — result
          // appears ~0.7s sooner on typical 4-8s missions.
          const age = Date.parse(json.mission.createdAt ?? "") || Date.now();
          const elapsed = Date.now() - age;
          timer = setTimeout(poll, elapsed < 15_000 ? 900 : 1600);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    };

    const reset = requestAnimationFrame(() => setData(null));
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(reset);
    };
  }, [missionId]);

  // Live clock: show how long the mission has been in its current state.
  // NOTE: all hooks must stay above every early return — otherwise React sees
  // a different hook order once `data` loads (Rules of Hooks).
  const missionCreatedAt = data?.mission.createdAt ?? null;
  const missionStatus = data?.mission.status ?? null;
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!missionCreatedAt || !missionStatus || !ACTIVE.includes(missionStatus)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [missionCreatedAt, missionStatus]);
  const clockText = React.useMemo(() => {
    if (!missionCreatedAt) return null;
    const started = Date.parse(missionCreatedAt);
    if (!Number.isFinite(started)) return null;
    const ms = now - started;
    if (ms < 0) return null;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ${sec % 60}s`;
    const hr = Math.floor(min / 60);
    return `${hr}h ${min % 60}m`;
  }, [missionCreatedAt, now]);

  const copyOutput = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  /** Renders a calm "still working" banner for legit long runs, and a
   *  hard CONNECTION LOST banner only when the poll hit an actual network/
   *  server error (not just because the mission is mid-flight). */
  const elapsedAgo = (iso: string | null) => {
    if (!iso) return null;
    const s = Date.parse(iso);
    if (!isFinite(s)) return null;
    const ms = Date.now() - s;
    if (ms < 0) return null;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ${sec % 60}s ago`;
    const hr = Math.floor(min / 60);
    return `${hr}h ${min % 60}m ago`;
  };

  const submitFollowUp = async () => {
    const text = refinement.trim();
    if (!text || !onFollowUp || followBusy) return;
    setFollowBusy(true);
    try {
      await onFollowUp(text);
      setRefinement("");
    } finally {
      setFollowBusy(false);
    }
  };

  const retry = async () => {
    if (!onRetry || retryBusy) return;
    setRetryBusy(true);
    try {
      await onRetry();
    } finally {
      setRetryBusy(false);
    }
  };

  if (error) {
    return (
      <section className="studio-run-panel">
        <p className="studio-eyebrow">CONNECTION LOST</p>
        <h2 className="studio-panel-title mt-2">Something interrupted the run.</h2>
        <p className="studio-muted mt-2 max-w-xl">
          The engine could not be reached. Your project is safe — try again in a moment.
        </p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={() => window.location.reload()} className="studio-primary-button">
            <RotateCcw className="size-3.5" /> Reload
          </button>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="studio-run-panel" aria-live="polite">
        <div className="flex items-center gap-3">
          <LoaderCircle className="size-4 animate-spin text-gold" />
          <span className="studio-eyebrow">CONNECTING TO GRAVITY</span>
        </div>
        <h2 className="studio-panel-title mt-3">Assembling the right intelligence.</h2>
      </section>
    );
  }

  const { mission, routing, nodes, evaluation, profile } = data;
  const running = ACTIVE.includes(mission.status);
  const failed = mission.status === "failed";
  /** A mission that is still active more than 3 minutes in is orphaned —
   *  the self-heal on /api/missions/:id should flip it to "failed". Until it
   *  does, show a calm banner instead of the scary CONNECTION LOST screen. */
  const orphaned =
    running &&
    Number.isFinite(Date.parse(mission.createdAt ?? "")) &&
    Date.now() - Date.parse(mission.createdAt!) > 3 * 60_000;
  const activeIndex = STATUS_INDEX[mission.status] ?? 0;

  // The run payload stores the real cause in node output (executeMission's
  // catch writes String(err) into the node output). Surface it on RUN FAILED
  // instead of the generic "provider hiccup or timeout" text. Store it here
  // (not in JSX) so the live clock below does not dedent the formatted line.
  const lastRun = nodes[0];
  const rawRunError = lastRun?.output ?? null;
  const runFailureReason = (
    rawRunError
      ? String(rawRunError)
          .replace(/^Error: /, "")
          .replace(/^[A-Z_]+: /, "")
          .replace(/^\s+|\s+$/g, "")
          .slice(0, 220)
      : null
  );
  const hasExplicitRunFailure = Boolean(runFailureReason && runFailureReason.length > 8);
  const failureReasonLabel = hasExplicitRunFailure
    ? runFailureReason
    : failed
      ? "engine hit an obstacle — retry re-runs the whole path"
      : "waiting for result";

  const synthesisNode =
    [...nodes].reverse().find((n) => {
      if (n.status !== "completed" || !n.output) return false;
      // Prefer nodes whose output looks like structured JSON
      try {
        const parsed = JSON.parse(n.output);
        return parsed && (parsed.type === "images" || parsed.type === "website");
      } catch {
        return false;
      }
    }) ??
    [...nodes].reverse().find((n) => n.status === "completed" && (n.tokens ?? 0) > 0) ??
    [...nodes].reverse().find((n) => n.output);

  const handledOrphan = orphaned && onRetry;

  const outputText = synthesisNode?.output ?? "";
  const workerNames = nodes.map((n) => n.name).filter(Boolean) as string[];
  const dimensions = (evaluation?.dimensions ?? []).filter((d) => d.score > 0).slice(0, 4);
  // User Control: strategies the kernel considered, deduped — the simulate
  // drawer lets the user force any of them on the identical task.
  const strategies = [...new Set((routing?.candidates ?? []).map((c) => c.strategy).filter(Boolean))];

  // --- Result portal data: hero stats, kind detection, engine trace ---
  const traceNodes: TraceNode[] = nodes.map((n) => ({
    id: n.id,
    name: n.name ?? "Worker",
    stage: n.stage ?? "",
    purpose: n.purpose,
    status: n.status,
    output: n.output,
    tokens: n.tokens ?? 0,
    latencyMs: n.latencyMs ?? 0,
  }));
  const completedCalls = traceNodes.filter((n) => n.tokens > 0).length;
  let parsedType: string | null = null;
  let parsedData: {
    images?: { url: string; prompt: string; width: number; height: number; seed?: number }[];
    html?: string;
    promptEnhanced?: boolean;
    overlay?: { text: string; placement: string; color: string; bgColor?: string } | null;
    selfHealed?: boolean;
    verification?: {
      verified: boolean;
      matches: boolean | null;
      confidence: number | null;
      feedback: string;
      model: string | null;
      reason?: string | null;
    } | null;
  } | null = null;
  try {
    const parsed = JSON.parse(outputText) as {
      type?: string;
      images?: { url: string; prompt: string; width: number; height: number; seed?: number }[];
      html?: string;
      promptEnhanced?: boolean;
      overlay?: { text: string; placement: string; color: string; bgColor?: string } | null;
      selfHealed?: boolean;
      verification?: {
        verified: boolean;
        matches: boolean | null;
        confidence: number | null;
        feedback: string;
        model: string | null;
        reason?: string | null;
      } | null;
    };
    if (parsed && typeof parsed.type === "string") {
      parsedType = parsed.type;
      parsedData = parsed;
    }
  } catch {
    /* plain markdown output */
  }
  const chartSeries = parsedType ? [] : detectSeries(outputText);
  const totalTokensUsed = data.run?.totalTokens ?? mission.totalTokens ?? 0;
  // Benchmark calibration: adaptive kernel ≈ 2.9x cheaper than the static
  // full pipeline on identical workloads (L4 2.4k vs L5 6.9k tokens).
  const staticEquivalent = Math.round(totalTokensUsed * 2.9);
  const heroStats: HeroStats = {
    tokens: totalTokensUsed,
    calls: completedCalls,
    costUsd: data.run ? data.run.totalCost : null,
    latencyMs: data.run?.totalLatencyMs ?? mission.totalLatencyMs,
    staticTokens: staticEquivalent,
  };
  const resultKind =
    parsedType === "images"
      ? "VISUAL"
      : parsedType === "website"
        ? "WEBSITE"
        : chartSeries.length > 0
          ? "DATA"
          : "REPORT";
  const overallQuality =
    dimensions.length > 0
      ? dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length
      : null;
  // Efficiency: qualityScore from the jury verdict (0..1). Media outputs are
  // graded by their verifier, NOT the text jury — compute path efficiency
  // directly (image gen is ~free: near-zero tokens → high efficiency).
  const mediaEfficiency =
    parsedType === "images" || parsedType === "website"
      ? Math.max(0.5, 1 - totalTokensUsed / 8000)
      : null;
  const overallQualityScore = evaluation?.qualityScore ?? null;
  const exportMd = buildExportMarkdown({
    title: titleFromPrompt(mission.prompt),
    tokens: totalTokensUsed || null,
    calls: completedCalls,
    costUsd: data.run ? data.run.totalCost : null,
    latencyMs: data.run?.totalLatencyMs ?? mission.totalLatencyMs,
    workers: workerNames,
    strategy: mission.selectedStrategy,    quality: overallQuality,    body: outputText,  });

  return (
    <>
      <section className="studio-run-panel" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="studio-eyebrow">
              {failed
                ? "RUN FAILED"
                : orphaned
                  ? "STILL RUNNING — LONG MISSION"
                  : running
                    ? "GRAVITY IS WORKING"
                    : "RESULT READY"}
            </p>
            <h2 className="studio-panel-title mt-2">
              {failed
                ? "This path did not complete."
                : orphaned
                  ? "This mission is taking longer than usual — GRAVITY is still working on it."
                  : running
                    ? "Assembling the right intelligence."
                    : "Your result is ready."}
            </h2>
            <UserInputSegment prompt={displayPrompt(mission.prompt)} running={running} />
          </div>
          <span
            className={`studio-status-pill ${
              failed
                ? "studio-status-pill-danger"
                : running
                  ? "studio-status-pill-busy"
                  : ""
            }`}
          >
            {!running && !failed ? <span className="status-dot" /> : null}
            {running ? `${mission.status.toUpperCase()}…${clockText ? ` · ${clockText}` : ""}` : failed ? "FAILED" : "COMPLETE"}
          </span>
        </div>

        {failed ? (
          <div className="mt-6 border border-[color:var(--color-border)] bg-[color:var(--color-void)] p-5">
            <p className="studio-muted leading-relaxed">
              {failureReasonLabel === "engine hit an obstacle — retry re-runs the whole path"
                ? "The engine hit an obstacle — usually a temporary provider hiccup or a timeout under load. Nothing was lost. Retrying re-runs the whole path."
                : `The engine stopped because ${failureReasonLabel}. Retrying re-runs the whole path.`}
            </p>
            {onRetry ? (
              <button
                type="button"
                onClick={retry}
                disabled={retryBusy}
                className="studio-primary-button mt-4"
              >
                <RotateCcw className={`size-3.5 ${retryBusy ? "animate-spin" : ""}`} />
                {retryBusy ? "Restarting…" : "Try again"}
              </button>
            ) : null}
          </div>
        ) : orphaned ? (
          <div className="mt-6 border border-[color:var(--color-border)] bg-[color:var(--color-void)] p-5">
            <p className="studio-muted leading-relaxed">
              This mission has been running for over 3 minutes. That can happen on the deeper
              intelligence paths (multi-agent, specialist). GRAVITY is still working on it —
              if the run does not complete soon, the engine will mark it failed automatically
              and you can try again.
              {mission.createdAt ? ` Started ${elapsedAgo(mission.createdAt)}.` : ""}
            </p>
          </div>
        ) : null}

        <div className="studio-workflow-line">
          {STEPS.map((step, index) => {
            // While running, the active step spins. Once the mission is done,
            // EVERY step — including the final one — shows a check. Without the
            // (!running && index === activeIndex) clause the COMPLETE marker
            // spins forever after the output is ready.
            const done = !failed && !orphaned && (index < activeIndex || (!running && index === activeIndex));
            const current = !failed && running && index === activeIndex;
            return (
              <div
                key={step.label}
                className={`studio-step ${done ? "studio-step-done" : ""} ${current ? "studio-step-current" : ""}`}
              >
                <div className="studio-step-marker">
                  {done ? (
                    <Check className="size-3" />
                  ) : current ? (
                    <LoaderCircle className="size-3 animate-spin" />
                  ) : (
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  )}
                </div>
                <div>
                  <p className="studio-step-label">{step.label}</p>
                  <p className="studio-step-detail">{step.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="studio-eyebrow">ASSEMBLED</span>
          {workerNames.length > 0 ? (
            workerNames.map((name, i) => (
              <span key={`${name}-${i}`} className="studio-worker-chip">
                {name}
              </span>
            ))
          ) : (
            <span className="studio-demo-note">Choosing workers…</span>
          )}
          <span className="ml-auto studio-demo-note">
            {routing?.selectedStrategy
              ? `${routing.selectedStrategy.replaceAll("_", " · ")} — no unnecessary escalation`
              : "No unnecessary model escalation"}
          </span>
        </div>

        {!running && !failed ? <HeroStatsStrip stats={heroStats} /> : null}

        {!running && !failed && outputText ? (
          <>            <ResultSurface
              prompt={mission.prompt}
              output={outputText}
              dimensions={dimensions}
              feedback={evaluation?.feedback ?? null}
              evaluation={evaluation}
              mission={mission}
              nodes={traceNodes}
              strategies={strategies}
              onSimulate={onSimulate}
              copied={copied}
              onCopy={() => copyOutput(outputText)}
              parsedType={parsedType}
              parsedData={parsedData}
              resultKind={resultKind}
              exportMd={exportMd}
              efficiencyScore={mediaEfficiency ?? overallQualityScore}
              completedCalls={completedCalls}
              totalTokensUsed={totalTokensUsed}
              run={data.run ?? null}
            />

            {/* Text/data results render their own collapsible trace inside
                ResultWindow; only image/website results need it here. */}
            {parsedType ? <EngineTrace nodes={traceNodes} /> : null}

            <ComparePanel
              selfTitle={titleFromPrompt(mission.prompt)}
              selfOutput={outputText}
              compareWith={compareWith}
            />

            {onFollowUp ? (
              <div className="mt-9 border-t border-border pt-6">
                <label className="studio-eyebrow" htmlFor="refine-input">
                  WHAT WOULD YOU LIKE TO CHANGE?
                </label>
                <div className="mt-3 flex items-center gap-3 border-b border-border pb-2">
                  <input
                    id="refine-input"
                    value={refinement}
                    onChange={(event) => setRefinement(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submitFollowUp();
                    }}
                    placeholder="Make it shorter, add a section, change the tone…"
                    className="studio-refine-input"
                    disabled={followBusy || running}
                  />
                  <button
                    type="button"
                    onClick={submitFollowUp}
                    disabled={!refinement.trim() || followBusy || running}
                    aria-label="Run refinement"
                    className="shrink-0 text-gold disabled:opacity-30"
                  >
                    {followBusy ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Wand2 className="size-4" />
                    )}
                  </button>
                </div>
                <p className="studio-meta mt-3">
                  RUNS AS A NEW TASK · SEEDED WITH THE ORIGINAL CONTEXT
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <HowWorked
        open={howOpen}
        onToggle={() => setHowOpen((current) => !current)}
        task={displayPrompt(mission.prompt)}
        strategy={mission.selectedStrategy}
        profile={
          profile
            ? [profile.dataType, profile.complexity, mission.domain].filter(Boolean).join(" · ") ||
              null
            : null
        }
        workers={workerNames.join(" · ") || null}
        reason={routing?.reasoning ?? null}
        effort={[
          mission.totalTokens ? `${mission.totalTokens.toLocaleString()} tokens` : null,
          mission.totalLatencyMs ? `${(mission.totalLatencyMs / 1000).toFixed(1)}s` : null,
          mission.confidence != null ? `confidence ${(mission.confidence * 100).toFixed(0)}%` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
    </>
  );
}

function ResultSurface({
  prompt,
  output,
  dimensions,
  feedback,
  evaluation,
  mission,
  nodes,
  strategies,
  onSimulate,
  copied,
  onCopy,
  parsedType,
  parsedData,
  resultKind,
  exportMd,
  efficiencyScore,
  completedCalls,
  totalTokensUsed,
  run,
}: {
  prompt: string;
  output: string;
  dimensions: { name: string; score: number }[];
  feedback: string | null;
  evaluation: {
    qualityScore: number | null;
    dimensions: { name: string; score: number }[] | null;
    feedback: string | null;
    outputVerdict?: string | null;
  } | null;
  mission: MissionData["mission"];
  nodes: TraceNode[];
  strategies: string[];
  onSimulate?: (strategy: string | null) => Promise<void>;
  copied: boolean;
  onCopy: () => void;
  parsedType: string | null;
  parsedData: {
    images?: { url: string; prompt: string; width: number; height: number; seed?: number }[];
    html?: string;
    promptEnhanced?: boolean;
    overlay?: { text: string; placement: string; color: string; bgColor?: string } | null;
    selfHealed?: boolean;
    verification?: {
      verified: boolean;
      matches: boolean | null;
      confidence: number | null;
      feedback: string;
      model: string | null;
      reason?: string | null;
    } | null;
  } | null;
  resultKind: string;
  exportMd: string;
  efficiencyScore: number | null;
  completedCalls: number;
  totalTokensUsed: number;
  run: { totalCost: number; totalTokens: number; totalLatencyMs: number; status: string } | null;
}) {
  // Text/data results get the full-width result window (senior spec: no right
  // column; metadata in horizontal containers below the output; User Control
  // for simulating other intelligence paths). Image/website results keep the
  // dedicated renderers below.
  if (!parsedType) {
    return (
      <ResultWindow
        title={titleFromPrompt(prompt)}
        output={output}
        resultKind={resultKind}
        evaluation={{
          qualityScore: evaluation?.qualityScore ?? null,
          dimensions,
          feedback,
          outputVerdict: evaluation?.outputVerdict ?? null,
        }}
        mission={{
          selectedStrategy: mission.selectedStrategy,
          escalationLevel: mission.escalationLevel,
          confidence: mission.confidence,
          totalTokens: mission.totalTokens,
          totalLatencyMs: mission.totalLatencyMs,
          completedAt: mission.completedAt,
          domain: mission.domain,
        }}
        run={run}
        nodes={nodes}
        totalTokensUsed={totalTokensUsed}
        completedCalls={completedCalls}
        copied={copied}
        onCopy={onCopy}
        exportMd={exportMd}
        strategies={strategies}
        onSimulate={onSimulate}
      />
    );
  }
  return (
    <div className="studio-result-grid">
      <div className="studio-output-preview">
        <div className="studio-preview-brand">
          <img src="/logo.jpg" alt="" aria-hidden="true" className="studio-mark-img studio-mark-img-sm" />
          <span>GRAVITY / STUDIO</span>
        </div>
        <div style={{ paddingTop: 28 }}>
          {parsedType === "images" && parsedData?.images ? (
            <ImageResult images={parsedData.images} overlay={parsedData.overlay} />
          ) : parsedType === "website" && parsedData?.html ? (
            <WebsiteResult html={parsedData.html} />
          ) : (
            <div className="studio-md-stack">
              <SectionedBrief markdown={output} />
              <AutoCharts markdown={output} />
            </div>
          )}
        </div>
        <span
          className="absolute right-4 bottom-3 font-mono text-gold uppercase"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.13em", fontSize: 8 }}
        >
          {parsedType === "images" ? "VISUAL / LIVE ENGINE" : parsedType === "website" ? "SITE / LIVE ENGINE" : "RESULT / LIVE ENGINE"}
        </span>
      </div>
      <div className="studio-result-copy">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="studio-eyebrow">RESULT</p>
            <h3 className="studio-result-title mt-2">{titleFromPrompt(prompt)}</h3>
          </div>
          <span className="studio-result-kind shrink-0">{resultKind}</span>
        </div>

        {parsedType === "images" && parsedData?.verification ? (
          <VerificationBadge verification={parsedData.verification} />
        ) : null}

        {parsedType === "images" && parsedData?.promptEnhanced ? (
          <p className="studio-enhanced-note">
            ✦ PROMPT REFINED — the jury LLM rewrote your idea into a richer
            image prompt (composition, lighting, palette) before rendering.
          </p>
        ) : null}

        <JuryScorecard dimensions={dimensions} feedback={feedback} />

        <div className="studio-efficiency">
          <p className="studio-eyebrow">EFFICIENCY</p>
          <div className="studio-efficiency-row">
            <span className="studio-efficiency-pct">
              {efficiencyScore != null ? `${Math.round(efficiencyScore * 100)}%` : "—"}
            </span>
            <div className="studio-efficiency-track">
              <div
                className="studio-efficiency-fill"
                style={{ width: efficiencyScore != null ? `${Math.round(efficiencyScore * 100)}%` : "0%" }}
              />
            </div>
          </div>
          <p className="studio-efficiency-note">
            {parsedType === "images" && parsedData?.verification
              ? parsedData.verification.verified
                ? parsedData.verification.feedback
                : `Vision verification skipped (${parsedData.verification.reason ?? "unavailable"}) — image delivered as generated.`
              : (feedback ?? "")}
            {` (${completedCalls} LLM call(s) · ${totalTokensUsed} tokens · $${(run ? run.totalCost : 0).toFixed(2)} spend${parsedType === "images" && parsedData?.promptEnhanced ? " · prompt refined by jury LLM" : ""}${parsedType === "images" && parsedData?.selfHealed ? " · self-healed after vision mismatch" : ""})`}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <button type="button" className="studio-secondary-button" onClick={onCopy}>
            <Copy className="size-3.5" />
            {copied ? "Copied" : parsedType === "website" ? "Copy HTML" : "Copy result"}
          </button>
          {parsedType === "website" && parsedData?.html ? (
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() =>
                downloadText(
                  `# ${titleFromPrompt(prompt)}\n\n> Generated by the GRAVITY engine.\n\nDownload the HTML file for the complete rendered site.\n`,
                  "gravity-result.md",
                )
              }
            >
              <Download className="size-3.5" /> Export .md
            </button>
          ) : null}
          {parsedType === "images" && parsedData?.images ? (
            <a
              href={parsedData.images[0]!.url}
              target="_blank"
              rel="noopener noreferrer"
              className="studio-secondary-button"
            >
              Open full size
            </a>
          ) : null}
          {parsedType === "images" && parsedData?.images ? (
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() =>
                downloadText(
                  parsedData!.images!.map((img, i) => `## Image ${i + 1}\n\n![Generated](${img.url})\n`).join("\n"),
                  "gravity-images.md",
                )
              }
            >
              <Download className="size-3.5" /> Export .md
            </button>
          ) : null}
          {/* Text results export via ResultWindow (Word + PDF + .md) — nothing to add here. */}
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsible USER INPUT segment — the senior's ask: the raw prompt used to
 * fill the whole result header as body text. Now it's a one-line collapsed
 * strip the user can expand; while running it stays expanded (feedback loop).
 */
function UserInputSegment({ prompt, running }: { prompt: string; running: boolean }) {
  const [open, setOpen] = React.useState(false);
  // Auto-collapse once the result lands; stay expanded while working.
  React.useEffect(() => {
    if (!running) setOpen(false);
  }, [running]);
  const oneLine = prompt.replace(/\s+/g, " ").trim();
  return (
    <div className="result-input-segment mt-3 max-w-xl">
      <button
        type="button"
        className="result-input-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="result-input-label">USER INPUT</span>
        {open ? null : <span className="result-input-preview">{oneLine.slice(0, 90)}{oneLine.length > 90 ? "…" : ""}</span>}
        <ChevronDown className={`result-input-chevron ${open ? "result-input-chevron-open" : ""}`} />
      </button>
      {open || running ? (
        <p className="result-input-body">{prompt}</p>
      ) : null}
    </div>
  );
}

function VerificationBadge({
  verification,
}: {
  verification: NonNullable<
    NonNullable<React.ComponentProps<typeof ResultSurface>["parsedData"]>["verification"]
  >;
}) {
  if (!verification.verified) {
    return (
      <div className="mt-4 flex items-center gap-2 border border-border px-3 py-2 opacity-60">
        <span className="font-mono text-[10px] uppercase tracking-widest">
          Image verification · skipped{verification.reason ? ` — ${verification.reason}` : ""}
        </span>
      </div>
    );
  }

  const matched = verification.matches === true;
  const pct =
    verification.confidence != null ? `${Math.round(verification.confidence * 100)}%` : "—";
  return (
    <div
      className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-2 ${
        matched ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400"
      }`}
    >
      <span className="font-mono text-[10px] uppercase tracking-widest">
        {matched ? "✓ Image verified — matches prompt" : "⚠ Vision check — possible mismatch"}
      </span>
      <span className="font-mono text-[10px] opacity-70">confidence {pct}</span>
      {verification.feedback ? (
        <span className="w-full text-xs opacity-80">{verification.feedback}</span>
      ) : null}
      {verification.model ? (
        <span className="w-full font-mono text-[10px] opacity-50">verifier: {verification.model}</span>
      ) : null}
    </div>
  );
}const IMAGE_RETRY_DELAYS = [3_000, 6_000, 12_000];

/**
 * Pollinations renders lazily, so a fresh seed can 5xx on the first browser
 * request. Retry with backoff instead of showing a broken alt-text; after the
 * final failure show a clean "still rendering" card the user can retry.
 */
function GenerateImage({
  img,
}: {
  img: { url: string; prompt: string; width: number; height: number };
}) {
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleError = () => {
    if (attempt < IMAGE_RETRY_DELAYS.length) {
      // Retry with backoff; bumping `attempt` changes the cache-busted src,
      // forcing the browser to re-request the (now finished) render.
      const delay = IMAGE_RETRY_DELAYS[attempt];
      timerRef.current = window.setTimeout(() => {
        setAttempt((a) => a + 1);
      }, delay);
    } else {
      setFailed(true);
    }
  };

  const src = attempt === 0 ? img.url : `${img.url}&retry=${attempt}`;

  if (failed) {
    // NOTE: rendered inside the card's outer <a>, so no nested anchor here —
    // the "Open full size" link below already covers the direct link.
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">
          This variation is still rendering
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={img.prompt}
      loading={attempt === 0 ? "eager" : "lazy"}
      onError={handleError}
    />
  );
}

function ImageResult({
  images,
  overlay,
}: {
  images: { url: string; prompt: string; width: number; height: number; seed?: number }[];
  overlay?: { text: string; placement: string; color: string; bgColor?: string } | null;
}) {
  const [refineIdx, setRefineIdx] = React.useState<number | null>(null);
  const [nudge, setNudge] = React.useState("");
  const [refining, setRefining] = React.useState(false);
  const [refineError, setRefineError] = React.useState<string | null>(null);
  const [variations, setVariations] = React.useState(images);

  // Keep local state in sync if the parent payload changes (new run).
  React.useEffect(() => {
    setVariations(images);
  }, [images]);

  const applyRefine = async (idx: number) => {
    if (refining || !nudge.trim()) return;
    const img = variations[idx];
    if (!img) return;
    setRefining(true);
    setRefineError(null);
    try {
      const res = await fetch("/api/image/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: img.prompt,
          nudge: nudge.trim(),
          seed: img.seed,
          width: img.width,
          height: img.height,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        image?: { url: string; prompt: string; width: number; height: number; seed: number };
      };
      if (!res.ok || !data.ok || !data.image) {
        setRefineError(data.error ?? `Refine failed (${res.status})`);
        return;
      }
      setVariations((prev) =>
        prev.map((im, i) => (i === idx ? { ...im, ...data.image! } : im)),
      );
      setNudge("");
      setRefineIdx(null);
    } catch {
      setRefineError("Network error while refining");
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="studio-image-grid">
      {variations.map((img, i) => (
        <div key={i} className="studio-image-card">
          <a href={img.url} target="_blank" rel="noopener noreferrer">
            <GenerateImage img={img} />
            {overlay ? (
              <span
                className={`studio-poster-overlay studio-poster-overlay-${overlay.placement}`}
                style={{ color: overlay.color, backgroundColor: overlay.bgColor }}
              >
                {overlay.text}
              </span>
            ) : null}
          </a>
          <div className="studio-image-overlay">
            <span className="studio-image-label">
              {img.width} x {img.height}
            </span>
          </div>
          <a
            href={img.url}
            target="_blank" rel="noopener noreferrer"
            className="studio-image-open-link"
          >
            Open full size
          </a>
          <button
            type="button"
            className="studio-refine-toggle"
            onClick={() =>
              void downloadImageFile(
                img.url,
                `gravity-image-${i + 1}.${img.url.startsWith("data:image/png") ? "png" : "jpg"}`,
              )
            }
            title="Download this image to disk"
          >
            ⤓ Download
          </button>
          <button
            type="button"
            className="studio-refine-toggle"
            onClick={() => {
              setRefineIdx(refineIdx === i ? null : i);
              setRefineError(null);
            }}
          >
            ✦ Refine
          </button>
          {refineIdx === i ? (
            <div className="studio-refine-panel">
              <input
                className="studio-refine-input"
                value={nudge}
                onChange={(e) => setNudge(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void applyRefine(i);
                }}
                placeholder="warmer colors, more minimal…"
                maxLength={200}
                disabled={refining}
              />
              <button
                type="button"
                className="studio-refine-apply"
                onClick={() => void applyRefine(i)}
                disabled={refining || !nudge.trim()}
              >
                {refining ? "Refining…" : "Apply"}
              </button>
              {refineError ? <p className="studio-refine-error">{refineError}</p> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function WebsiteResult({ html }: { html: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const [device, setDevice] = React.useState<"desktop" | "tablet" | "mobile">("desktop");
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Auto-resize iframe to content height
  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc && doc.body) {
          const height = Math.min(doc.body.scrollHeight + 20, 700);
          iframe.style.height = `${height}px`;
        }
      } catch {
        // Cross-origin — use default height
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [html]);

  return (
    <div className="studio-website-container">
      <div className="studio-website-chrome">
        <div className="studio-chrome-dots">
          <span className="chrome-dot" style={{ background: "#ff5f57" }} />
          <span className="chrome-dot" style={{ background: "#ffbd2e" }} />
          <span className="chrome-dot" style={{ background: "#28c840" }} />
        </div>
        <div className="studio-chrome-url">gravity.studio/generated</div>
        <div className="studio-website-devices">
          {(
            [
              ["desktop", Monitor, "Desktop"],
              ["tablet", Tablet, "Tablet"],
              ["mobile", Smartphone, "Mobile"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              aria-label={label}
              title={label}
              className={`studio-device-button ${device === key ? "studio-device-button-active" : ""}`}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </div>
      <div
        className="studio-website-preview"
        style={{
          maxWidth: device === "mobile" ? 390 : device === "tablet" ? 768 : "100%",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <iframe
          ref={iframeRef}
          srcDoc={html}
          title="Generated website"
          sandbox="allow-scripts allow-modals"
          className="studio-website-iframe"
          style={{ height: "500px" }}
        />
      </div>
      <div className="studio-website-actions">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="studio-secondary-button"
          >
            {expanded ? "Hide source" : "View source code"}
          </button>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([html], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "gravity-generated.html";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="studio-secondary-button"
          >
            Download HTML
          </button>
          <button
            type="button"
            onClick={() => {
              const w = window.open("", "_blank");
              if (w) {
                w.document.write(html);
                w.document.close();
              }
            }}
            className="studio-secondary-button"
          >
            Open in new tab
          </button>
        </div>
        {expanded ? (
          <pre className="studio-code-block">
            <code>{html}</code>
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function HowWorked({
  open,
  onToggle,
  task,
  strategy,
  profile,
  workers,
  reason,
  effort,
}: {
  open: boolean;
  onToggle: () => void;
  task: string;
  strategy: string | null;
  profile: string | null;
  workers: string | null;
  reason: string | null;
  effort: string;
}) {
  const rows: Array<[string, string]> = [
    ["Task", task],
    ["Strategy", strategy?.replaceAll("_", " ") ?? "Routing…"],
    ["Profile", profile ?? "—"],
    ["Workers", workers ?? "—"],
    ["Reason", reason ?? "—"],
    ["Effort", effort || "—"],
  ];
  return (
    <div className="studio-how-worked">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span>
          <span className="studio-eyebrow block">HOW GRAVITY WORKED</span>
          <span className="mt-1 block text-sm text-[color:var(--color-muted-foreground)]">
            Progressive transparency, not technical noise.
          </span>
        </span>
        <ChevronDown
          className={`size-4 text-[color:var(--color-muted-foreground)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="border-b border-border pb-3">
              <p className="studio-eyebrow">{label}</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--color-ivory-dim)]">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
