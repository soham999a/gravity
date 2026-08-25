"use client";

import * as React from "react";
import { Check, ChevronDown, Copy, LoaderCircle, RotateCcw, Wand2 } from "lucide-react";

interface MissionData {
  mission: {
    id: string;
    prompt: string;
    status: string;
    domain: string | null;
    selectedStrategy: string | null;
    totalTokens: number | null;
    totalLatencyMs: number | null;
    confidence: number | null;
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
  }[];
  evaluation: {
    qualityScore: number | null;
    dimensions: { name: string; score: number }[] | null;
    feedback: string | null;
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
  const clean = prompt.replace(/\s+/g, " ").trim();
  return clean.length > 64 ? `${clean.slice(0, 61)}…` : clean || "A considered response";
}

export function MissionRun({
  missionId,
  onFollowUp,
  onRetry,
}: {
  missionId: string;
  /** Runs a refinement as a brand-new task seeded with the original context. */
  onFollowUp?: (refinement: string) => Promise<void>;
  /** Re-executes this same mission after a failure. */
  onRetry?: () => Promise<void>;
}) {
  const [data, setData] = React.useState<MissionData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [howOpen, setHowOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [refinement, setRefinement] = React.useState("");
  const [followBusy, setFollowBusy] = React.useState(false);
  const [retryBusy, setRetryBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/missions/${missionId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = (await res.json()) as MissionData;
        if (cancelled) return;
        setData(json);
        setError(null);
        if (ACTIVE.includes(json.mission.status)) {
          timer = setTimeout(poll, 1600);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    };

    setData(null);
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [missionId]);

  const copyOutput = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
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
  const activeIndex = STATUS_INDEX[mission.status] ?? 0;

  const synthesisNode =
    [...nodes].reverse().find((n) => n.status === "completed" && (n.tokens ?? 0) > 0) ??
    [...nodes].reverse().find((n) => n.output);

  const outputText = synthesisNode?.output ?? "";
  const workerNames = nodes.map((n) => n.name).filter(Boolean) as string[];
  const dimensions = (evaluation?.dimensions ?? []).filter((d) => d.score > 0).slice(0, 4);

  return (
    <>
      <section className="studio-run-panel" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="studio-eyebrow">
              {failed ? "RUN FAILED" : running ? "GRAVITY IS WORKING" : "RESULT READY"}
            </p>
            <h2 className="studio-panel-title mt-2">
              {failed
                ? "This path did not complete."
                : running
                  ? "Assembling the right intelligence."
                  : "Your result is ready."}
            </h2>
            <p className="studio-muted mt-3 max-w-xl">{mission.prompt}</p>
          </div>
          <span className={`studio-status-pill ${running ? "studio-status-pill-busy" : ""}`}>
            {!running && !failed ? <span className="status-dot" /> : null}
            {running ? `${mission.status.toUpperCase()}…` : failed ? "FAILED" : "COMPLETE"}
          </span>
        </div>

        {failed ? (
          <div className="mt-6 border border-[color:var(--color-border)] bg-[color:var(--color-void)] p-5">
            <p className="studio-muted leading-relaxed">
              The engine hit an obstacle — usually a temporary provider hiccup or a timeout under
              load. Nothing was lost. Retrying re-runs the whole path.
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
        ) : null}

        <div className="studio-workflow-line">
          {STEPS.map((step, index) => {
            const done = !failed && index < activeIndex;
            const current = !failed && index === activeIndex;
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

        {!running && !failed && outputText ? (
          <>
            <ResultSurface
              prompt={mission.prompt}
              output={outputText}
              dimensions={dimensions}
              feedback={evaluation?.feedback ?? null}
              copied={copied}
              onCopy={() => copyOutput(outputText)}
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
        task={mission.prompt}
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
  copied,
  onCopy,
}: {
  prompt: string;
  output: string;
  dimensions: { name: string; score: number }[];
  feedback: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="studio-result-grid">
      <div className="studio-output-preview">
        <div className="studio-preview-brand">
          <span className="studio-mark" style={{ height: 20, width: 20, fontSize: 10 }}>
            G
          </span>
          <span>GRAVITY / STUDIO</span>
        </div>
        <div style={{ paddingTop: 28 }}>
          <p className="studio-output-text">{output}</p>
        </div>
        <span
          className="absolute right-4 bottom-3 font-mono text-gold uppercase"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.13em", fontSize: 8 }}
        >
          RESULT / LIVE ENGINE
        </span>
      </div>
      <div className="studio-result-copy">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="studio-eyebrow">RESULT</p>
            <h3 className="studio-result-title mt-2">{titleFromPrompt(prompt)}</h3>
          </div>
          <span className="studio-result-kind shrink-0">BRIEF</span>
        </div>

        {dimensions.length > 0 ? (
          <div className="mt-6 studio-score-row">
            {dimensions.map((d) => (
              <div key={d.name}>
                <div className="flex items-baseline justify-between">
                  <span
                    className="uppercase"
                    style={{
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.17em",
                      fontSize: 9,
                      color: "var(--color-muted-foreground)",
                    }}
                  >
                    {d.name}
                  </span>
                  <span className="font-mono text-[9px] text-gold">
                    {Math.round(d.score * 100)}%
                  </span>
                </div>
                <div className="studio-score-bar mt-1.5">
                  <div
                    className="studio-score-fill"
                    style={{ width: `${Math.round(d.score * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {feedback ? <p className="studio-muted mt-5 leading-relaxed">{feedback}</p> : null}

        <div className="mt-8 flex flex-wrap gap-2">
          <button type="button" className="studio-secondary-button" onClick={onCopy}>
            <Copy className="size-3.5" />
            {copied ? "Copied" : "Copy result"}
          </button>
        </div>
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
