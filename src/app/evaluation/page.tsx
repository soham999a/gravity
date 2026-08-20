"use client";

import { Panel, Bar } from "@/components/gravity/primitives";

const DIMENSIONS = [
  { name: "Task Success Rate", score: 91, delta: 3 },
  { name: "Routing Accuracy", score: 94, delta: 2 },
  { name: "Cost Efficiency", score: 97, delta: 5 },
  { name: "Latency Performance", score: 88, delta: -1 },
  { name: "Hallucination Rate", score: 98, delta: 1 },
  { name: "Confidence Calibration", score: 86, delta: 4 },
  { name: "Escalation Accuracy", score: 92, delta: 2 },
  { name: "Fallback Recovery", score: 95, delta: 3 },
  { name: "Output Quality", score: 89, delta: 1 },
  { name: "User Satisfaction", score: 84, delta: 6 },
  { name: "Throughput", score: 91, delta: 0 },
];

export default function EvaluationPage() {
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
          <Panel title="Evaluation Dimensions">
            <div className="space-y-3">
              {DIMENSIONS.map((d) => (
                <div key={d.name} className="flex items-center gap-4">
                  <span className="w-[200px] shrink-0 font-mono text-[9px] tracking-[0.1em] uppercase text-ivory-faint">{d.name}</span>
                  <div className="flex-1 h-2 bg-border">
                    <Bar value={d.score} color={d.score > 90 ? "success" : d.score > 80 ? "gold" : "warning"} />
                  </div>
                  <span className="font-mono text-[10px] text-ivory-dim w-8 text-right">{d.score}%</span>
                  <span className={`font-mono text-[10px] w-8 text-right ${d.delta > 0 ? "text-success-text" : d.delta < 0 ? "text-danger-text" : "text-ivory-faint"}`}>
                    {d.delta > 0 ? `+${d.delta}` : d.delta}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Verdicts */}
          <div className="space-y-6">
            <Panel title="Verdicts">
              <div className="mb-6">
                <div className="kicker mb-2">Output Verdict</div>
                <div className="p-4 border border-success/20 bg-success/5 text-center">
                  <div className="font-serif text-3xl font-light text-success-text">Pass</div>
                  <div className="text-[11px] text-ivory-faint mt-1">Quality score: 89% — above 80% threshold</div>
                </div>
              </div>
              <div>
                <div className="kicker mb-2">Decision Verdict</div>
                <div className="p-4 border border-gold/20 bg-gold-pale text-center">
                  <div className="font-serif text-3xl font-light text-gold">Optimal</div>
                  <div className="text-[11px] text-ivory-faint mt-1">Routing matches expected escalation levels</div>
                </div>
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
