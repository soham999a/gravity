"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

/* ===========================================================================
   GRAVITY result portal building blocks:
   hero stat strip, sectioned brief, auto-charts, jury scorecard,
   engine trace, reveal helpers and metadata export.
   =========================================================================== */

export interface HeroStats {
  tokens: number;
  calls: number;
  costUsd: number | null;
  latencyMs: number | null;
  /** Static-equivalent token estimate, for the savings badge. */
  staticTokens: number | null;
}

export interface ScoreDimension {
  name: string;
  score: number;
}

export interface TraceNode {
  id: string;
  name: string;
  stage: string;
  purpose: string | null;
  status: string | null;
  output: string | null;
  tokens: number;
  latencyMs: number;
}

/* ---------------------------------------------------------------------------
   Count-up reveal — animates 0 → value once on mount (prefers-reduced-motion
   aware via CSS transitions; JS anim guarded by matchMedia).
   --------------------------------------------------------------------------- */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    if (!Number.isFinite(target)) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Reduced motion: zero duration lands on the target on the first frame.
    const duration = reduced ? 0 : durationMs;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = reduced ? 1 : 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

/* ---------------------------------------------------------------------------
   HERO — the architecture story in four numbers + savings badge
   --------------------------------------------------------------------------- */
export function HeroStatsStrip({ stats }: { stats: HeroStats }) {
  const tokens = useCountUp(stats.tokens);
  const calls = useCountUp(stats.calls);
  const latency = useCountUp(stats.latencyMs ?? 0);
  const savings =
    stats.staticTokens && stats.staticTokens > stats.tokens
      ? 1 - stats.tokens / stats.staticTokens
      : null;

  return (
    <div className="result-hero">
      <div className="result-hero-tiles">
        <div className="result-tile">
          <span className="result-tile-label">TOKENS</span>
          <span className="result-tile-value">{Math.round(tokens).toLocaleString()}</span>
        </div>
        <div className="result-tile">
          <span className="result-tile-label">LLM CALLS</span>
          <span className="result-tile-value">{Math.round(calls)}</span>
        </div>
        <div className="result-tile">
          <span className="result-tile-label">COST</span>
          <span className="result-tile-value">
            {stats.costUsd != null ? `$${stats.costUsd.toFixed(2)}` : "$0.00"}
          </span>
        </div>
        <div className="result-tile">
          <span className="result-tile-label">TIME</span>
          <span className="result-tile-value">
            {stats.latencyMs ? `${(latency / 1000).toFixed(1)}s` : "—"}
          </span>
        </div>
      </div>
      {savings != null ? (
        <div className="result-savings" title="Adaptive kernel vs a static full-pipeline run on the same request">
          <span className="result-savings-arrow">▼</span>
          {Math.round(savings * 100)}% FEWER TOKENS THAN A STATIC PIPELINE
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   SECTIONED BRIEF — split markdown into numbered section cards.
   Recognizes: ## 1. Title / **1. Title** / 1. Title / ## Title
   Falls back to one flowing card when no headings are found.
   --------------------------------------------------------------------------- */
interface BriefSection {
  title: string;
  body: string;
}

function splitIntoSections(md: string): BriefSection[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const heading = /^(#{1,4})\s+(.*)$|^\*\*(\d[^*]*?)\*\*\s*$|^(\d{1,2})\.\s+(.+)$/;
  const sections: BriefSection[] = [];
  let current: BriefSection | null = null;

  for (const line of lines) {
    const m = line.match(heading);
    if (m) {
      const rawTitle = (m[2] ?? m[3] ?? `${m[4]}. ${m[5]}`).trim();
      const cleanedTitle = rawTitle.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "");
      current = { title: cleanedTitle, body: "" };
      sections.push(current);
      continue;
    }
    if (!current) current = { title: "", body: "" };
    if (sections[sections.length - 1] !== current) sections.push(current);
    current.body += `${line}\n`;
  }

  const meaningful = sections.filter((s) => s.title || s.body.trim());
  // No real headings? Treat the whole output as one flowing card.
  const hasHeadings = meaningful.some((s) => s.title && s.body.trim().length > 0);
  if (!hasHeadings || meaningful.length < 2) {
    return [{ title: "", body: md }];
  }
  return meaningful;
}

function SectionCard({ section, index }: { section: BriefSection; index: number }) {
  const isKeyFindings = /key find|finding|insight/i.test(section.title);
  return (
    <article className={`result-section-card ${isKeyFindings ? "result-section-card-findings" : ""}`}>
      {section.title ? (
        <h4 className="result-section-title">
          <span className="result-section-num">{String(index + 1).padStart(2, "0")}</span>
          {section.title}
        </h4>
      ) : null}
      <div className="result-section-body">
        <MarkdownLite>{section.body}</MarkdownLite>
      </div>
    </article>
  );
}

export function SectionedBrief({ markdown }: { markdown: string }) {
  const sections = React.useMemo(() => splitIntoSections(markdown), [markdown]);
  if (sections.length <= 1 && !sections[0]?.title) {
    return <MarkdownLite>{markdown}</MarkdownLite>;
  }
  return (
    <div className="result-sections">
      {sections.map((s, i) => (
        <SectionCard key={`${s.title}-${i}`} section={s} index={i} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   MarkdownLite — inline markdown without importing the app-wide renderer
   (keeps this module dependency-light and avoids circular imports).
   --------------------------------------------------------------------------- */
export function MarkdownLite({ children }: { children: string }) {
  const html = React.useMemo(() => {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let out = esc(children);
    // bold / italics
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)?!]|$)/g, "$1<em>$2</em>");
    // inline code
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    // bare urls
    out = out.replace(
      /(https?:\/\/[^\s<>"')]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    // lists
    out = out.replace(/(^|\n)((?:[-*]\s[^\n]+\n?)+)/g, (_m, p1, block: string) => {
      const items = block
        .trim()
        .split("\n")
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
      return `${p1}<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    });
    // paragraphs
    out = out
      .split(/\n{2,}/)
      .map((p) => (p.trim() ? `<p>${p.trim().replace(/\n/g, "<br/>")}</p>` : ""))
      .join("");
    return out;
  }, [children]);
  return <div className="result-mdlite" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------------------------------------------------------------------------
   AUTO-CHARTS — pull numeric series out of the markdown and draw SVG charts.
   Detects two shapes:
     a) labeled runs:  "Jan 1200, Feb 1350, Mar 1290" or "1200, 1350, 1290"
     b) table rows:    | Month | Demand |  /  | 1200 | 1350 |
   --------------------------------------------------------------------------- */
export interface DetectedSeries {
  label: string;
  points: { label: string; value: number }[];
}

export function detectSeries(md: string): DetectedSeries[] {
  const clean = md.replace(/\r\n/g, "\n");
  const found: DetectedSeries[] = [];

  // b) markdown tables: first column = label, some numeric column
  const tableRows = [...clean.matchAll(/^\|(.+)\|\s*$/gm)].map((m) =>
    m[1]!.split("|").map((c) => c.replace(/[*_`]/g, "").trim()),
  );
  if (tableRows.length >= 3) {
    const header = tableRows[0]!;
    const isDivider = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c));
    const numCol = header.findIndex(
      (h, i) =>
        i > 0 &&
        tableRows
          .slice(2)
          .every((r) => r[i] != null && r[i] !== "" && Number.isFinite(Number(r[i]?.replace(/[, ]/g, "")))),
    );
    if (numCol > 0) {
      const points = tableRows
        .slice(2)
        .filter((r) => !isDivider(r))
        .map((r) => ({ label: r[0] ?? "", value: Number(r[numCol]?.replace(/[, ]/g, "")) }))
        .filter((p) => Number.isFinite(p.value))
        .slice(0, 12);
      if (points.length >= 3) {
        found.push({ label: header[numCol] ?? "Values", points });
      }
    }
  }

  if (found.length > 0) return found;

  // a) labeled runs inside prose: "Jan: 1200" / "Jan 1200" / "Q1 - 1200"
  const runRe =
    /([A-Z][A-Za-z]{2,11}|Q[1-4])\s*[:=\-–—]?\s+(\d[\d,]*(?:\.\d+)?)(?=(?:\s*,\s*[A-Z][A-Za-z]{2,11}\s*[:=\-–—]?\s*\d[\d,]*(?:\.\d+)?)*\s*\.?\s*$|\s*[.,;]|$)/g;
  const seen: { label: string; value: number }[] = [];
  for (const m of clean.matchAll(runRe)) {
    const value = Number(m[2]?.replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    if (seen.length > 0 || /(?:[A-Z][A-Za-z]{2,11}|Q[1-4])\s*[:=\-–—]?\s+\d[\d,]*(?:\.\d+)?/.test(clean.slice(m.index! + (m[0]?.length ?? 0)))) {
      seen.push({ label: m[1]!.replace(/[*_`:]/g, ""), value });
      if (seen.length >= 12) break;
    }
  }
  // Only accept if we caught at least 3 chained points (avoid stray numbers)
  if (seen.length >= 3) {
    found.push({ label: "Series", points: seen });
  }
  return found;
}

function trendPath(points: { value: number }[], w: number, h: number, pad: number): string {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return points
    .map((p, i) => {
      const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
      const y = h - pad - ((p.value - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function SeriesChart({ series }: { series: DetectedSeries }) {
  const { points } = series;
  const w = 560;
  const h = 190;
  const pad = 14;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const line = trendPath(points, w, h, pad);
  const area = `${line} L${(w - pad).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const last = values[values.length - 1]!;
  const first = values[0]!;
  const drift = first !== 0 ? ((last - first) / first) * 100 : 0;

  return (
    <div className="result-chart">
      <div className="result-chart-head">
        <span className="result-chart-label">{series.label.toUpperCase()}</span>
        <span className="result-chart-meta">
          {points.length} POINTS · AVG {avg.toLocaleString(undefined, { maximumFractionDigits: 1 })} ·{" "}
          <span className={drift >= 0 ? "result-chart-up" : "result-chart-down"}>
            {drift >= 0 ? "▲" : "▼"} {Math.abs(drift).toFixed(1)}%
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="result-chart-svg" role="img" aria-label={`${series.label} trend chart`}>
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(184,150,12,0.28)" />
            <stop offset="100%" stopColor="rgba(184,150,12,0.02)" />
          </linearGradient>
        </defs>
        <line x1={pad} y1={h - pad - ((avg - min) / span) * (h - pad * 2)} x2={w - pad} y2={h - pad - ((avg - min) / span) * (h - pad * 2)} className="result-chart-avgline" />
        <path d={area} fill="url(#chart-fill)" stroke="none" />
        <path d={line} fill="none" className="result-chart-line" />
        {points.map((p, i) => {
          const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
          const y = h - pad - ((p.value - min) / span) * (h - pad * 2);
          return (
            <g key={`${p.label}-${i}`}>
              <circle cx={x} cy={y} r={3} className="result-chart-dot" />
              <text x={x} y={h - 3} textAnchor="middle" className="result-chart-tick">
                {p.label}
              </text>
              <text x={x} y={y - 8} textAnchor="middle" className="result-chart-value">
                {p.value.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AutoCharts({ markdown }: { markdown: string }) {
  const seriesList = React.useMemo(() => detectSeries(markdown), [markdown]);
  if (seriesList.length === 0) return null;
  return (
    <div className="result-charts">
      {seriesList.slice(0, 2).map((s, i) => (
        <SeriesChart key={`${s.label}-${i}`} series={s} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   JURY SCORECARD — animated dimension bars + overall quality ring + verdict
   --------------------------------------------------------------------------- */
function QualityRing({ score }: { score: number }) {
  const animated = useCountUp(score, 1100);
  const pct = Math.round(animated * 100);
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="result-ring" role="img" aria-label={`Overall quality ${pct} percent`}>
      <svg viewBox="0 0 72 72" width={72} height={72}>
        <circle cx="36" cy="36" r={r} className="result-ring-track" />
        <circle
          cx="36"
          cy="36"
          r={r}
          className="result-ring-fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - animated)}
        />
      </svg>
      <span className="result-ring-num">{pct}</span>
    </div>
  );
}

export function JuryScorecard({
  dimensions,
  feedback,
}: {
  dimensions: ScoreDimension[];
  feedback: string | null;
}) {
  if (dimensions.length === 0 && !feedback) return null;
  const overall =
    dimensions.length > 0 ? dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length : null;

  return (
    <div className="result-jury">
      <div className="result-jury-head">
        <div>
          <p className="studio-eyebrow">MODEL JURY</p>
          <p className="result-jury-sub">Every result graded before you see it</p>
        </div>
        {overall != null ? <QualityRing score={overall} /> : null}
      </div>
      {dimensions.length > 0 ? (
        <div className="result-jury-bars">
          {dimensions.map((d, i) => {
            const pct = Math.round(d.score * 100);
            return (
              <div key={d.name} className="result-jury-dim">
                <div className="result-jury-dim-row">
                  <span className="result-jury-dim-name">{d.name.toUpperCase()}</span>
                  <span className="result-jury-dim-pct">{pct}%</span>
                </div>
                <div className="result-jury-track">
                  <div
                    className="result-jury-fill"
                    style={{ width: `${pct}%`, animationDelay: `${i * 120}ms` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {feedback ? <p className="result-jury-verdict">{feedback}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   ENGINE TRACE — worker-by-worker timeline (replaces the raw JSON dump)
   --------------------------------------------------------------------------- */
const STAGE_LABELS: Record<string, string> = {
  profile: "PROFILE",
  routing: "ROUTING",
  planning: "PLANNER",
  specialist: "SPECIALIST",
  critic: "CRITIC",
  synthesis: "SYNTHESISER",
  evaluation: "JURY",
};

function stageLabel(node: TraceNode): string {
  const key = Object.keys(STAGE_LABELS).find((k) =>
    node.stage?.toLowerCase().includes(k) || node.name?.toLowerCase().includes(k),
  );
  return key ? STAGE_LABELS[key]! : (node.stage ?? "WORKER").toUpperCase();
}

function TraceRow({ node, index }: { node: TraceNode; index: number }) {
  const [open, setOpen] = React.useState(false);
  const preview =
    node.output && node.output.length > 0
      ? node.output.replace(/\s+/g, " ").trim().slice(0, 90)
      : null;

  return (
    <div className={`result-trace-row ${open ? "result-trace-row-open" : ""}`}>
      <button type="button" className="result-trace-head" onClick={() => setOpen((v) => !v)}>
        <span className="result-trace-num">{String(index + 1).padStart(2, "0")}</span>
        <span className="result-trace-name">
          <span className="result-trace-stage">{stageLabel(node)}</span>
          {node.name}
        </span>
        <span className="result-trace-meta">
          {node.tokens > 0 ? `${node.tokens.toLocaleString()} tok` : "—"} ·{" "}
          {node.latencyMs > 0 ? `${(node.latencyMs / 1000).toFixed(1)}s` : "—"}
        </span>
        <ChevronDown className="result-trace-chevron" />
      </button>
      {open ? (
        <div className="result-trace-body">
          {node.purpose ? <p className="result-trace-purpose">{node.purpose}</p> : null}
          {preview ? (
            <p className="result-trace-output">
              {node.output && node.output.length > 90 ? `${node.output.replace(/\s+/g, " ").trim().slice(0, 400)}${node.output.length > 400 ? "…" : ""}` : node.output}
            </p>
          ) : (
            <p className="result-trace-output result-trace-empty">No output recorded for this worker.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function EngineTrace({ nodes }: { nodes: TraceNode[] }) {
  const usable = nodes.filter((n) => n.name || n.output);
  if (usable.length === 0) return null;
  return (
    <div className="result-trace">
      <p className="studio-eyebrow">ENGINE TRACE</p>
      <p className="result-trace-sub">
        {usable.length} workers assembled · click any row to see what it did
      </p>
      <div className="result-trace-list">
        {usable.map((n, i) => (
          <TraceRow key={n.id} node={n} index={i} />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   EXPORT — metadata-rich markdown download
   --------------------------------------------------------------------------- */
export function buildExportMarkdown(opts: {
  title: string;
  body: string;
  tokens: number | null;
  calls: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  workers: string[];
  strategy: string | null;
  quality: number | null;
}): string {
  const lines: (string | null)[] = [
    `# ${opts.title}`,
    "",
    `> Generated by GRAVITY Studio — adaptive intelligence, least complex sufficient path.`,
    "",
    "| Metric | Value |",
    "| --- | --- |",
    opts.tokens != null ? `| Tokens | ${opts.tokens.toLocaleString()} |` : null,
    opts.calls != null ? `| LLM calls | ${opts.calls} |` : null,
    opts.costUsd != null ? `| Cost | $${opts.costUsd.toFixed(4)} |` : null,
    opts.latencyMs != null ? `| Time | ${(opts.latencyMs / 1000).toFixed(1)}s |` : null,
    opts.workers.length > 0 ? `| Workers | ${opts.workers.join(", ")} |` : null,
    opts.strategy ? `| Strategy | ${opts.strategy.replaceAll("_", " ")} |` : null,
    opts.quality != null ? `| Jury quality | ${Math.round(opts.quality * 100)}% |` : null,
    "",
    "---",
    "",
    opts.body,
  ];
  return lines.filter((l) => l !== null).join("\n");
}
