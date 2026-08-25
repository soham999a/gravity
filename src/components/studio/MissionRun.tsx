"use client";

import * as React from "react";
import { Check, ChevronDown, Copy, LoaderCircle } from "lucide-react";

interface MissionData {
  mission: {
    id: string;
    prompt: string;
    status: string;
    domain: string | null;
    selectedStrategy: string | null;
    totalTokens: number | null;
    totalCost: string | null;
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
  failed: -1,
};

function titleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  return clean.length > 64 ? `${clean.slice(0, 61)}…` : clean || "A considered response";
}

export function MissionRun({ missionId }: { missionId: string }) {
  const [data, setData] = React.useState<MissionData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [howOpen, setHowOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

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
        if (ACTIVE.includes(json.mission.status)) {
          timer = setTimeout(poll, 1600);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    };

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

  if (error) {
    return (
      <section className="studio-run-panel">
        <p className="studio-eyebrow">CONNECTION LOST</p>
        <h2 className="studio-panel-title mt-2">Something interrupted the run.</h2>
        <p className="studio-muted mt-2">The engine could not be reached. Try again in a moment.</p>
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
              {failed
                ? "RUN FAILED"
                : running
                  ? "GRAVITY IS WORKING"
                  : "RESULT READY"}
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
          <span
            className={`studio-status-pill ${running ? "studio-status-pill-busy" : ""}`}
          >
            {!running && !failed ? <span className="status-dot" /> : null}
            {running ? `${mission.status.toUpperCase()}…` : failed ? "FAILED" : "COMPLETE"}
          </span>
        </div>

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
          <ResultSurface
            prompt={mission.prompt}
            output={outputText}
            kind={synthesisNode?.stage ?? "DOCUMENT"}
            dimensions={dimensions}
            feedback={evaluation?.feedback ?? null}
            copied={copied}
            onCopy={() => copyOutput(outputText)}
          />
        ) : null}
      </section>

      <HowWorked
        open={howOpen}
        onToggle={() => setHowOpen((current) => !current)}
        task={mission.prompt}
        strategy={mission.selectedStrategy}
        profile={
          profile
            ? [profile.dataType, profile.complexity, mission.domain]
                .filter(Boolean)
                .join(" · ") || null
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
  kind,
  dimensions,
  feedback,
  copied,
  onCopy,
}: {
  prompt: string;
  output: string;
  kind: string;
  dimensions: { name: string; score: number }[];
  feedback?: string | null;
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
          className="absolute right-4 bottom-3 font-mono text-[8px] tracking-[0.13em] text-gold uppercase"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.13em", fontSize: 8 }}
        >
          {(kind || "RESULT").toUpperCase()} / LIVE ENGINE
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
                  <span className="studio-meta" style={{ color: "var(--color-muted-foreground)" }}>
                    {d.name}
                  </span>
                  <span className="font-mono text-[9px] text-gold">
                    {Math.round(d.score * 100)}%
                  </span>
                </div>
                <div className="studio-score-bar mt-1.5">
                  <div className="studio-score-fill" style={{ width: `${Math.round(d.score * 100)}%` }} />
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

        <div className="mt-8">
          <label className="studio-eyebrow" htmlFor={`refine-${prompt.length}`}>
            WHAT WOULD YOU LIKE TO CHANGE?
          </label>
          <input
            id={`refine-${prompt.length}`}
            placeholder="Describe a follow-up task in the composer above"
            className="studio-refine-input mt-3 border-b border-border pb-2"
            disabled
          />
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
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between text-left">
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
