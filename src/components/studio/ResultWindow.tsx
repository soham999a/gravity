"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Download,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { AutoCharts, EngineTrace, SectionedBrief, type TraceNode } from "./ResultPortal";

/* ===========================================================================
   RESULT WINDOW — the full-width result surface.

   Senior spec (latest):
   • output takes the full width — no right-hand column
   • metadata lives in horizontal containers BELOW the output
   • a User Control button appears with the result and opens a panel where
     the user can simulate the same task through a different intelligence
     strategy
   • Quality (model jury) and Computational Efficiency are shown as two
     SEPARATE panels — never mixed into one score.
   =========================================================================== */

export interface ResultWindowMission {
  selectedStrategy: string | null;
  escalationLevel: number | string | null;
  confidence: number | null;
  totalTokens: number | null;
  totalLatencyMs: number | null;
  completedAt: string | null;
  domain: string | null;
}

export interface ResultWindowEvaluation {
  qualityScore: number | null;
  dimensions: { name: string; score: number }[] | null;
  feedback: string | null;
  outputVerdict?: string | null;
}

const LEVEL_LABELS: Record<number, string> = {
  0: "L0 · Deterministic",
  1: "L1 · Compute",
  2: "L2 · Balanced",
  3: "L3 · Specialist",
  4: "L4 · Deep",
  5: "L5 · Multi-agent",
  6: "L6 · Human review",
};

function levelLabel(level: number | string | null): string {
  const n = typeof level === "string" ? Number(level) : level;
  return n != null && Number.isFinite(n) ? (LEVEL_LABELS[n] ?? `L${n}`) : "Adaptive";
}

function formatStrategy(s: string | null): string {
  return s ? s.replaceAll("_", " · ") : "adaptive";
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* --------------------------------------------------------------------------- */

function VerdictBadge({ verdict }: { verdict: string | null | undefined }) {
  if (verdict === "pass") {
    return (
      <div className="result-verdict result-verdict-pass" role="status">
        <span className="result-verdict-icon">
          <Check className="size-3.5" />
        </span>
        <span>
          <strong>VERIFIED</strong>
          <small>Result met the quality thresholds</small>
        </span>
      </div>
    );
  }
  if (verdict === "fail") {
    return (
      <div className="result-verdict result-verdict-fail" role="status">
        <span className="result-verdict-icon">
          <XCircle className="size-3.5" />
        </span>
        <span>
          <strong>FAILED CHECKS</strong>
          <small>Consider simulating another path</small>
        </span>
      </div>
    );
  }
  return (
    <div className="result-verdict result-verdict-review" role="status">
      <span className="result-verdict-icon">
        <AlertTriangle className="size-3.5" />
      </span>
      <span>
        <strong>NEEDS REVIEW</strong>
        <small>Open the verification panel below</small>
      </span>
    </div>
  );
}

/* --------------------------------------------------------------------------- */

function QualityRing({ score }: { score: number }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);
  const animated = mounted ? score : 0;
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="result-quality-ring" role="img" aria-label={`Overall quality ${Math.round(score * 100)} percent`}>
      <svg viewBox="0 0 80 80" width={80} height={80}>
        <circle cx="40" cy="40" r={r} className="result-ring-track" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className="result-ring-fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - animated)}
        />
      </svg>
      <span className="result-quality-num">{Math.round(score * 100)}</span>
    </div>
  );
}

function PanelJury({
  dimensions,
  qualityScore,
}: {
  dimensions: { name: string; score: number }[];
  qualityScore: number | null;
}) {
  const overall = qualityScore ?? (dimensions.length > 0 ? dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length : null);
  return (
    <div className="result-panel">
      <p className="result-panel-title">RESULT QUALITY</p>
      <p className="result-panel-sub">Graded by the model jury before you saw it</p>
      <div className="result-jury-body">
        {overall != null ? <QualityRing score={overall} /> : null}
        <div className="result-jury-dims">
          {dimensions.map((d, i) => {
            const pct = Math.round(d.score * 100);
            return (
              <div key={d.name} className="result-jury-dim">
                <div className="result-jury-dim-row">
                  <span className="result-jury-dim-name">{d.name.toUpperCase()}</span>
                  <span className="result-jury-dim-pct">{pct}%</span>
                </div>
                <div className="result-jury-track">
                  <div className="result-jury-fill" style={{ width: `${pct}%`, animationDelay: `${i * 110}ms` }} />
                </div>
              </div>
            );
          })}
          {dimensions.length === 0 ? <p className="result-panel-empty">No dimensions recorded.</p> : null}
        </div>
      </div>
    </div>
  );
}

function PanelEfficiency({
  tokens,
  latencyMs,
  costUsd,
  reliability,
  completedCalls,
  level,
}: {
  tokens: number;
  latencyMs: number | null;
  costUsd: number | null;
  reliability: number | null;
  completedCalls: number;
  level: string;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Token usage", value: tokens.toLocaleString() },
    { label: "Latency", value: latencyMs ? `${(latencyMs / 1000).toFixed(1)} s` : "—" },
    { label: "Provider cost", value: `$${(costUsd ?? 0).toFixed(2)}${(costUsd ?? 0) === 0 ? " · free-tier" : ""}` },
    { label: "Model calls", value: String(completedCalls) },
    { label: "Intelligence level", value: level },
  ];
  return (
    <div className="result-panel">
      <p className="result-panel-title">
        COMPUTATIONAL EFFICIENCY <span className="result-panel-sep">separate from quality</span>
      </p>
      <p className="result-panel-sub">What the path cost to run — independent of output quality</p>
      <div className="result-eff-rows">
        {rows.map((r) => (
          <div key={r.label} className="result-eff-row">
            <span className="result-eff-label">{r.label.toUpperCase()}</span>
            <span className="result-eff-value">{r.value}</span>
          </div>
        ))}
        {reliability != null ? (
          <div className="result-eff-row result-eff-row-bar">
            <span className="result-eff-label">RELIABILITY</span>
            <span className="result-eff-value">{Math.round(reliability * 100)}%</span>
            <div className="result-jury-track result-eff-track">
              <div className="result-jury-fill" style={{ width: `${Math.round(reliability * 100)}%` }} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function VerificationDonut({ supported, review }: { supported: number; review: number }) {
  const total = Math.max(1, supported + review);
  const r = 24;
  const c = 2 * Math.PI * r;
  const supportedLen = (supported / total) * c;
  return (
    <svg viewBox="0 0 64 64" width={64} height={64} className="result-verify-donut" role="img" aria-label={`${supported} supported, ${review} needs review`}>
      <circle cx="32" cy="32" r={r} className="result-ring-track" />
      <circle
        cx="32"
        cy="32"
        r={r}
        className="result-verify-arc-supported"
        strokeDasharray={`${supportedLen} ${c - supportedLen}`}
        transform="rotate(-90 32 32)"
      />
      {review > 0 ? (
        <circle
          cx="32"
          cy="32"
          r={r}
          className="result-verify-arc-review"
          strokeDasharray={`${(review / total) * c} ${c}`}
          strokeDashoffset={-supportedLen}
          transform="rotate(-90 32 32)"
        />
      ) : null}
      <text x="32" y="37" textAnchor="middle" className="result-verify-total">
        {total}
      </text>
    </svg>
  );
}

function PanelVerification({
  outputVerdict,
  feedback,
  evidenceBacked,
  confidence,
}: {
  outputVerdict: string | null | undefined;
  feedback: string | null;
  evidenceBacked: number;
  confidence: number | null;
}) {
  const review = outputVerdict === "review" || outputVerdict === "fail" ? 1 : 0;
  const supported = evidenceBacked;
  return (
    <div className="result-panel">
      <p className="result-panel-title">VERIFICATION SUMMARY</p>
      <p className="result-panel-sub">Derived from model jury + evidence coverage</p>
      <div className="result-verify-body">
        <VerificationDonut supported={supported} review={review} />
        <div className="result-verify-tally">
          <div className="result-verify-row">
            <span className="result-verify-dot result-verify-dot-supported" />
            {supported} evidence-backed claim{supported === 1 ? "" : "s"}
          </div>
          <div className="result-verify-row">
            <span className="result-verify-dot result-verify-dot-review" />
            {review} claim{review === 1 ? "" : "s"} {review === 1 ? "needs" : "need"} review
          </div>
          {confidence != null ? (
            <div className="result-verify-row result-verify-row-muted">
              routing confidence {(confidence * 100).toFixed(0)}%
            </div>
          ) : null}
        </div>
      </div>
      {review > 0 ? (
        <div className="result-verify-callout">
          <ShieldCheck className="size-3.5" />
          One claim lacks sufficient evidence — verify critical use before acting on it.
        </div>
      ) : null}
      {feedback ? <p className="result-verify-feedback">{feedback}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------------------------- */

function UserControl({
  strategies,
  onSimulate,
}: {
  strategies: string[];
  onSimulate?: (strategy: string | null) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [picked, setPicked] = React.useState<string | null>(null); // null = AUTO
  const [busy, setBusy] = React.useState(false);

  const run = async () => {
    if (!onSimulate || busy) return;
    setBusy(true);
    try {
      await onSimulate(picked);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="userctl">
      <button
        type="button"
        className={`studio-secondary-button ${open ? "userctl-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <SlidersHorizontal className="size-3.5" />
        User Control
      </button>
      {open ? (
        <div className="userctl-drawer" role="region" aria-label="User control — simulate">
          <p className="userctl-title">SIMULATE THIS TASK</p>
          <p className="userctl-sub">
            Re-runs this exact task through the intelligence path you pick. The kernel&apos;s own
            choice is marked — compare paths on identical input.
          </p>
          <div className="userctl-chips">
            <button
              type="button"
              className={`userctl-chip ${picked === null ? "userctl-chip-active" : ""}`}
              onClick={() => setPicked(null)}
            >
              AUTO · kernel decides
            </button>
            {strategies.map((s) => (
              <button
                key={s}
                type="button"
                className={`userctl-chip ${picked === s ? "userctl-chip-active" : ""}`}
                onClick={() => setPicked(s)}
              >
                {formatStrategy(s)}
              </button>
            ))}
          </div>
          <button type="button" className="studio-primary-button userctl-run" onClick={run} disabled={busy || !onSimulate}>
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {busy ? "Simulating…" : "Run simulation"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------- */

function CollapsibleTrace({ nodes }: { nodes: TraceNode[] }) {
  const [open, setOpen] = React.useState(true);
  const usable = nodes.filter((n) => n.name || n.output);
  if (usable.length === 0) return null;
  return (
    <div className={`result-trace-wrap ${open ? "result-trace-wrap-open" : ""}`}>
      <button type="button" className="result-trace-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="studio-eyebrow">ENGINE TRACE</span>
        <span className="result-trace-toggle-meta">
          {usable.length} workers assembled — what each one did
        </span>
        <ChevronDown className="result-trace-chevron" />
      </button>
      {open ? <EngineTrace nodes={nodes} /> : null}
    </div>
  );
}

/* --------------------------------------------------------------------------- */

export function ResultWindow({
  title,
  output,
  resultKind,
  evaluation,
  mission,
  run,
  nodes,
  totalTokensUsed,
  completedCalls,
  copied,
  onCopy,
  exportMd,
  strategies,
  onSimulate,
}: {
  title: string;
  output: string;
  resultKind: string;
  evaluation: ResultWindowEvaluation | null;
  mission: ResultWindowMission;
  run: { totalCost: number; totalTokens: number; totalLatencyMs: number; status: string } | null;
  nodes: TraceNode[];
  totalTokensUsed: number;
  completedCalls: number;
  copied: boolean;
  onCopy: () => void;
  exportMd: string;
  strategies: string[];
  onSimulate?: (strategy: string | null) => Promise<void>;
}) {
  const dimensions = (evaluation?.dimensions ?? []).filter((d) => d.score > 0).slice(0, 5);
  const verdict = evaluation?.outputVerdict ?? null;

  // Reliability: successful model calls vs attempted (completed + failed workers).
  const failedWorkers = nodes.filter(
    (n) => n.status && n.status !== "completed" && n.status !== "skipped",
  ).length;
  const attempted = completedCalls + failedWorkers;
  const reliability = attempted > 0 ? completedCalls / attempted : null;

  // Honest evidence coverage: how many explicit "Evidence:" lines the output carries.
  const evidenceBacked = (output.match(/(^|\n)[ \t]*(?:[-*+]\s*)?(?:\*\*)?\s*evidence\s*:?/gi) ?? []).length;

  const latencyMs = run?.totalLatencyMs ?? mission.totalLatencyMs ?? null;
  const completed = formatTime(mission.completedAt);

  return (
    <div className="result-window">
      <header className="result-window-head">
        <div className="result-window-head-main">
          <p className="studio-eyebrow">GRAVITY / RESULT</p>
          <h3 className="result-window-title">{title}</h3>
          <div className="result-meta-chips">
            <span className="result-meta-chip">{formatStrategy(mission.selectedStrategy)}</span>
            <span className="result-meta-chip">{levelLabel(mission.escalationLevel)}</span>
            <span className="result-meta-chip">{completedCalls} model call{completedCalls === 1 ? "" : "s"}</span>
            <span className="result-meta-chip">{totalTokensUsed.toLocaleString()} tokens</span>
            {latencyMs ? <span className="result-meta-chip">{(latencyMs / 1000).toFixed(1)}s</span> : null}
            {mission.domain ? <span className="result-meta-chip">{mission.domain}</span> : null}
          </div>
          {completed ? <p className="result-window-completed">Completed at {completed}</p> : null}
        </div>
        <div className="result-window-head-side">
          <VerdictBadge verdict={verdict} />
          <div className="result-window-actions">
            <button type="button" className="studio-secondary-button" onClick={onCopy}>
              <Copy className="size-3.5" />
              {copied ? "Copied" : "Copy result"}
            </button>
            <button type="button" className="studio-secondary-button" onClick={() => {
              const blob = new Blob([exportMd], { type: "text/markdown;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "gravity-result.md";
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="size-3.5" /> Export .md
            </button>
            <UserControl strategies={strategies} onSimulate={onSimulate} />
          </div>
        </div>
      </header>

      <span className="result-window-kind">{resultKind}</span>

      {/* Full-width output — the senior's primary ask. */}
      <div className="result-window-output">
        <SectionedBrief markdown={output} />
        <AutoCharts markdown={output} />
      </div>

      {/* Horizontal containers BELOW the output. */}
      <div className="result-panels">
        <PanelJury dimensions={dimensions} qualityScore={evaluation?.qualityScore ?? null} />
        <PanelEfficiency
          tokens={totalTokensUsed}
          latencyMs={latencyMs}
          costUsd={run?.totalCost ?? null}
          reliability={reliability}
          completedCalls={completedCalls}
          level={levelLabel(mission.escalationLevel)}
        />
        <PanelVerification
          outputVerdict={verdict}
          feedback={evaluation?.feedback ?? null}
          evidenceBacked={evidenceBacked}
          confidence={mission.confidence}
        />
      </div>

      <CollapsibleTrace nodes={nodes} />
    </div>
  );
}
