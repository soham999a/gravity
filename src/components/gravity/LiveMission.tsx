"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Bar } from "@/components/gravity/primitives";

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
    dimensions: { name: string; score: number; maxScore: number }[] | null;
  } | null;
  routing: {
    candidates: { name: string; suitabilityScore: number; reasoning: string; strategy: string }[] | null;
    selectedStrategy: string | null;
    voiScore: number | null;
    confidence: number | null;
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
  } | null;
}

const ACTIVE_STATUSES = ["pending", "profiling", "routing", "executing", "evaluating"];

export function LiveMission({ missionId }: { missionId: string }) {
  const [data, setData] = React.useState<MissionData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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
        if (ACTIVE_STATUSES.includes(json.mission.status)) {
          timer = setTimeout(poll, 1800);
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

  if (error) {
    return <div className="p-6 border border-border bg-deep text-[12px] text-danger-text">Live mission error: {error}</div>;
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 p-8">
        <Loader2 size={14} className="animate-spin text-gold" />
        <span className="kicker">Connecting to GRAVITY engine…</span>
      </div>
    );
  }

  const { mission, profile, routing, nodes, evaluation } = data;
  const isRunning = ACTIVE_STATUSES.includes(mission.status);
  const sortedCandidates = [...(routing?.candidates ?? [])].sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  const synthesisNode = [...nodes].reverse().find((n) => n.status === "completed" && (n.tokens ?? 0) > 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 pb-5 border-b border-border">
        <div className="min-w-0">
          <div className="kicker-gold mb-2">Live Mission · {mission.id.slice(0, 8)}</div>
          <div className="font-serif text-lg text-ivory leading-snug">{mission.prompt}</div>
        </div>
        <span
          className={`shrink-0 font-mono text-[9px] tracking-[0.12em] uppercase px-2.5 py-1 border ${
            isRunning
              ? "border-gold/40 text-gold"
              : mission.status === "completed"
                ? "border-success/40 text-success-text"
                : "border-danger/40 text-danger-text"
          }`}
        >
          {isRunning ? `${mission.status}…` : mission.status}
        </span>
      </div>

      {/* Profile */}
      {profile && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-6">
          {[
            { label: "Domain", value: mission.domain ?? "—" },
            { label: "Data Type", value: profile.dataType ?? "—" },
            { label: "Complexity", value: profile.complexity ?? "—" },
            { label: "Strategy", value: mission.selectedStrategy ?? "routing…" },
          ].map((item) => (
            <div key={item.label} className="bg-deep p-4">
              <div className="kicker mb-1">{item.label}</div>
              <div className="font-mono text-[11px] text-ivory capitalize">{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Routing */}
      {sortedCandidates.length > 0 && (
        <div className="mb-6">
          <div className="kicker mb-3">Value-of-Intelligence Routing</div>
          <div className="space-y-1.5">
            {sortedCandidates.map((c) => {
              const selected = c.strategy === routing?.selectedStrategy;
              return (
                <div
                  key={c.strategy}
                  className={`flex items-center gap-3 px-3 py-2 border ${
                    selected ? "border-gold/50 bg-gold-pale" : "border-border bg-void opacity-60"
                  }`}
                >
                  {selected ? (
                    <CheckCircle2 size={13} className="text-gold shrink-0" />
                  ) : (
                    <span className="w-[13px] shrink-0" />
                  )}
                  <span className={`font-mono text-[10px] ${selected ? "text-gold" : "text-ivory-faint"} w-44 shrink-0`}>
                    {c.name}
                  </span>
                  <div className="flex-1 h-1 bg-border overflow-hidden">
                    <div
                      className={selected ? "h-full bg-gold" : "h-full bg-border-light"}
                      style={{ width: `${c.suitabilityScore}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-ivory-faint w-8 text-right">{c.suitabilityScore}</span>
                </div>
              );
            })}
          </div>
          {routing?.reasoning && (
            <p className="text-[11px] text-ivory-faint mt-2 leading-relaxed">{routing.reasoning}</p>
          )}
        </div>
      )}

      {/* Execution nodes */}
      <div className="mb-6">
        <div className="kicker mb-3">Execution Trace</div>
        {nodes.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-5 border border-border bg-void">
            <Loader2 size={13} className="animate-spin text-gold" />
            <span className="font-mono text-[10px] text-ivory-faint">Awaiting execution nodes…</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {nodes.map((n) => (
              <div key={n.id} className="grid grid-cols-[110px_1fr_90px_80px] border border-border bg-void">
                <div className="px-3 py-2.5 bg-surface border-r border-border font-mono text-[8px] uppercase tracking-[0.1em] text-ivory-faint flex items-center">
                  {n.stage ?? "—"}
                </div>
                <div className="px-3 py-2.5 flex items-center min-w-0">
                  <span className="text-[11px] text-ivory-dim truncate">{n.name}</span>
                </div>
                <div className="px-3 py-2.5 font-mono text-[9px] text-ivory-faint flex items-center justify-end">
                  {n.tokens ? `${n.tokens} tok` : "—"}
                </div>
                <div className="px-3 py-2.5 flex items-center justify-end">
                  {n.status === "running" ? (
                    <Loader2 size={12} className="animate-spin text-gold" />
                  ) : n.status === "completed" ? (
                    <CheckCircle2 size={12} className="text-success-text" />
                  ) : n.status === "failed" ? (
                    <span className="font-mono text-[8px] text-danger-text">FAILED</span>
                  ) : (
                    <span className="w-3 h-3 border border-border-light rounded-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output */}
      {!isRunning && synthesisNode && (
        <div className="border border-border bg-void p-5 mb-6">
          <div className="kicker-gold mb-3">Final Output</div>
          <pre className="whitespace-pre-wrap font-sans text-[12px] text-ivory-dim leading-relaxed max-h-[420px] overflow-auto">
            {synthesisNode.output}
          </pre>
        </div>
      )}

      {/* Evaluation */}
      {!isRunning && evaluation && (
        <div className="p-5 border border-border bg-void">
          <div className="kicker-gold mb-3">Evaluation Summary</div>
          <div className="grid grid-cols-2 gap-6 mb-4">
            {(evaluation.dimensions ?? []).slice(0, 4).map((d) => (
              <div key={d.name}>
                <div className="text-[11px] text-ivory-faint mb-2">{d.name}</div>
                <Bar value={Math.round(d.score * 100)} label={`${Math.round(d.score * 100)}%`} />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ivory-dim leading-relaxed">{evaluation.feedback}</p>
        </div>
      )}
    </div>
  );
}
