"use client";

import { cn } from "@/lib/utils";
import type { ProblemProfile, RoutingDecision } from "@/lib/gravity/types";
import { Bar, KeyValue, Meta, Panel, SimulatedTag, dur, money } from "./primitives";

export function DecisionMatrix({ decision }: { decision: RoutingDecision }) {
  const ranked = [...decision.candidates].sort((a, b) => b.suitability - a.suitability);
  return (
    <Panel index="05" title="Intelligence Decision" aside={<SimulatedTag />}>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              {["Strategy", "Suitability", "Expected Quality", "Est. Cost", "Latency", "Risk", "Confidence"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={cn("meta py-2 text-left font-normal", i > 0 && "text-right")}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {ranked.map((c) => {
              const selected = c.kind === decision.selected;
              return (
                <tr
                  key={c.kind}
                  className={cn(
                    "border-b border-border/50 transition-colors hover:bg-surface/60",
                    selected && "bg-gold/5",
                  )}
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block h-3 w-[2px]",
                          selected ? "bg-gold" : "bg-transparent",
                        )}
                      />
                      <span
                        className={cn(
                          "font-mono text-[0.7rem] tracking-[0.12em] uppercase",
                          selected ? "text-gold" : "text-ivory",
                        )}
                      >
                        {c.label}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <div className="ml-auto w-32">
                      <div className="font-mono text-xs tabular-nums">{c.suitability}%</div>
                      <div className="mt-1">
                        <Bar value={c.suitability} tone={selected ? "gold" : "muted"} />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right font-mono text-xs tabular-nums">{c.expectedQuality}%</td>
                  <td className="py-3 text-right font-mono text-xs tabular-nums">{money(c.estimatedCost)}</td>
                  <td className="py-3 text-right font-mono text-xs tabular-nums">{dur(c.latencyMs)}</td>
                  <td className="py-3 text-right">
                    <span
                      className={cn(
                        "font-mono text-[0.65rem] tracking-[0.14em] uppercase",
                        c.risk === "low" && "text-success-text",
                        c.risk === "medium" && "text-warning-text",
                        c.risk === "high" && "text-danger-text",
                      )}
                    >
                      {c.risk}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono text-xs tabular-nums">{c.confidence}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 border border-gold/30 bg-gold/[0.04] p-6">
        <Meta className="text-gold">Selected Strategy</Meta>
        <h3 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">{decision.selectedLabel}</h3>
        <div className="mt-5 max-w-3xl border-l border-gold/40 pl-4">
          <Meta>Reason</Meta>
          <p className="mt-2 text-sm leading-relaxed text-ivory-dim">{decision.reason}</p>
        </div>
      </div>
    </Panel>
  );
}

export function ProfileDimensions({ profile }: { profile: ProblemProfile }) {
  return (
    <Panel index="04" title="Problem Signals" aside={<SimulatedTag />}>
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {profile.dimensions.map((d) => (
          <div key={d.label}>
            <div className="flex items-baseline justify-between gap-3">
              <Meta>{d.label}</Meta>
              <span className="font-mono text-xs tabular-nums">{d.score}</span>
            </div>
            <div className="mt-2">
              <Bar value={d.score} tone={d.score >= 70 ? "gold" : "muted"} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <Meta>Measured Profile</Meta>
          <div className="mt-3">
            {profile.signals.map((s) => (
              <KeyValue key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        </div>
        <div>
          <Meta>Problem Profile</Meta>
          <ul className="mt-3 space-y-2">
            {profile.summary.map((line) => (
              <li key={line} className="flex gap-3 text-sm text-ivory-dim">
                <span className="text-gold">—</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

export function ValueOfIntelligencePanel({ decision }: { decision: RoutingDecision }) {
  const v = decision.valueOfIntelligence;
  const escalate = v.verdict === "escalate";
  return (
    <Panel index="06" title="Value of Intelligence" aside={<SimulatedTag />}>
      <p className="max-w-2xl text-sm text-ivory-dim">
        Does additional computational intelligence materially improve the expected outcome?
      </p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <KeyValue label="Current expected quality" value={`${v.currentQuality}%`} />
          <KeyValue
            label="+ Additional expected quality"
            value={`+${v.additionalQuality}%`}
            tone="gold"
          />
          <KeyValue label="− Additional computational cost" value={money(v.additionalCost)} />
          <KeyValue label="− Latency impact" value={`+${dur(v.latencyImpactMs)}`} />
          <KeyValue label="− Risk impact" value={v.riskImpact.toUpperCase()} />
        </div>
        <div
          className={cn(
            "flex flex-col justify-center border p-6 text-center",
            escalate ? "border-warning-text/40 bg-warning/5" : "border-success/30 bg-success/5",
          )}
        >
          <Meta>Verdict</Meta>
          <p
            className={cn(
              "mt-3 font-display text-2xl leading-tight",
              escalate ? "text-warning-text" : "text-success-text",
            )}
          >
            {escalate ? "Escalation Recommended" : "Intelligence Sufficient"}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ivory-dim">
            {escalate
              ? "Marginal quality gain exceeds marginal cost, latency and risk."
              : "Marginal quality gain does not justify additional cost, latency or risk."}
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function ReasoningBudgetPanel({ decision }: { decision: RoutingDecision }) {
  const b = decision.budget;
  const pct = Math.round((b.usedTokens / b.tokenBudget) * 100);
  const escalate = b.decision === "escalate";
  return (
    <Panel index="07" title="Adaptive Reasoning Budget" aside={<SimulatedTag />}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <Meta>Used Tokens</Meta>
              <p className="font-mono text-3xl tabular-nums text-gold">
                {b.usedTokens.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <Meta>Token Budget</Meta>
              <p className="font-mono text-xl tabular-nums">{b.tokenBudget.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <Bar value={pct} />
          </div>
          <div className="mt-6">
            <KeyValue label="Remaining budget" value={(b.tokenBudget - b.usedTokens).toLocaleString()} />
            <KeyValue label="Expected cost" value={money(b.expectedCost)} />
            <KeyValue label="Actual cost" value={money(b.actualCost)} />
            <KeyValue label="Confidence" value={`${b.confidence}%`} tone="gold" />
          </div>
        </div>
        <div
          className={cn(
            "flex flex-col justify-center border p-6 text-center",
            escalate ? "border-warning-text/40 bg-warning/5" : "border-border bg-surface/60",
          )}
        >
          <Meta>Decision</Meta>
          <p
            className={cn(
              "mt-3 font-display text-2xl leading-tight",
              escalate ? "text-warning-text" : "text-gold",
            )}
          >
            {escalate ? "Escalate" : "Stop"}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ivory-dim">
            {escalate
              ? "Confidence below threshold — allocate additional reasoning."
              : "Sufficient confidence reached — halt further reasoning."}
          </p>
        </div>
      </div>
    </Panel>
  );
}
