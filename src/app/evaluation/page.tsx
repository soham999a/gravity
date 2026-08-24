"use client";

import * as React from "react";
import { Panel, Bar } from "@/components/gravity/primitives";

interface EvalRow {
  id: string;
  prompt: string | null;
  dimensions: { name: string; score: number; delta?: number }[];
  qualityScore: number;
  outputVerdict: string;
  decisionVerdict: string;
  feedback: string;
}

export default function EvaluationPage() {
  const [rows, setRows] = React.useState<EvalRow[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/evaluations", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.live) setRows(json.items);
      } catch {
        /* keep empty */
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // aggregate live evaluation dimension averages
  const agg = new Map<string, { total: number; count: number }>();
  for (const r of rows ?? []) {
    for (const d of r.dimensions ?? []) {
      const cur = agg.get(d.name) ?? { total: 0, count: 0 };
      cur.total += d.score;
      cur.count += 1;
      agg.set(d.name, cur);
    }
  }
  const liveDims = [...agg.entries()].map(([name, v]) => ({
    name,
    score: Math.round((v.total / v.count) * 100),
  }));
  const dims = liveDims.length > 0 ? liveDims : FALLBACK_DIMS;

  const latest = rows?.[0];
  const passCount = (rows ?? []).filter((r) => r.outputVerdict === "pass").length;
  const optimalCount = (rows ?? []).filter((r) => r.decisionVerdict === "optimal").length;
  const outVerdict = latest
    ? `${passCount}/${(rows ?? []).length} missions pass`
    : "Awaiting first mission";
  const decVerdict = latest ? `${optimalCount}/${(rows ?? []).length} optimal` : "—";

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Observability</div>
          <h1 className="section-title mb-4">Evaluation <em>Lab</em></h1>
          <p className="section-desc">
            Multi-dimensional evaluation of GRAVITY&apos;s intelligence allocation performance across all metrics.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-6">
          {/* Dimensions */}
          <Panel title={liveDims.length > 0 ? `Evaluation Dimensions — ${rows?.length} Live Evaluations` : "Evaluation Dimensions"}>
            <div className="space-y-3">
              {dims.map((d) => (
                <div key={d.name} className="flex items-center gap-4">
                  <span className="w-[200px] shrink-0 font-mono text-[9px] tracking-[0.1em] uppercase text-ivory-faint">{d.name}</span>
                  <div className="flex-1 h-2 bg-border">
                    <Bar value={d.score} color={d.score > 90 ? "success" : d.score > 80 ? "gold" : "warning"} />
                  </div>
                  <span className="font-mono text-[10px] text-ivory-dim w-8 text-right">{d.score}%</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Verdicts */}
          <div className="space-y-6">
            <Panel title="Latest Evaluation">
              {latest ? (
                <>
                  <div className="mb-6">
                    <div className="kicker mb-2">Output Verdict</div>
                    <div className={`p-4 border text-center ${latest.outputVerdict === "pass" ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5"}`}>
                      <div className={`font-serif text-3xl font-light ${latest.outputVerdict === "pass" ? "text-success-text" : "text-danger-text"}`}>
                        {latest.outputVerdict}
                      </div>
                      <div className="text-[11px] text-ivory-faint mt-1">
                        Quality score: {Math.round(latest.qualityScore * 100)}%
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="kicker mb-2">Decision Verdict</div>
                    <div className="p-4 border border-gold/20 bg-gold-pale text-center">
                      <div className="font-serif text-3xl font-light text-gold">{latest.decisionVerdict}</div>
                      <div className="text-[11px] text-ivory-faint mt-1">Routing efficiency assessment</div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-ivory-faint italic">{outVerdict}</p>
              )}
            </Panel>

            <Panel title="Recent Feedback">
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {(rows ?? []).slice(0, 8).map((r) => (
                  <div key={r.id} className="p-3 border border-border bg-deep">
                    <div className="text-[11px] text-ivory-dim truncate mb-1">{r.prompt ?? r.id}</div>
                    <div className="font-mono text-[9px] text-ivory-faint">{r.feedback}</div>
                  </div>
                ))}
                {!latest && <p className="text-[13px] text-ivory-faint italic px-3 py-2">No evaluations yet.</p>}
              </div>
            </Panel>

            <Panel title="Feedback Loop">
              <div className="space-y-0">
                {["Task", "Profile", "Decision", "Execute", "Evaluate", "Feedback", "Better Routing"].map((s, i) => (
                  <div key={s} className="flex items-center">
                    <div className={`flex-1 p-3 text-center border border-border ${i === 6 ? "bg-gold-pale border-gold/30" : "bg-deep"}`}>
                      <div className="kicker mb-1">{String(i + 1).padStart(2, "0")}</div>
                      <div className={`font-serif text-sm ${i === 6 ? "text-gold" : "text-ivory"}`}>{s}</div>
                    </div>
                    {i < 6 && <div className="px-2 font-mono text-[10px] text-gold-dim">→</div>}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

const FALLBACK_DIMS = [
  { name: "Task Success Rate", score: 91 },
  { name: "Routing Accuracy", score: 94 },
  { name: "Cost Efficiency", score: 97 },
  { name: "Latency Performance", score: 88 },
  { name: "Output Quality", score: 89 },
];
