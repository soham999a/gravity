"use client";

import * as React from "react";
import { Panel, StatusDot } from "@/components/gravity/primitives";
import { ExecutionCanvas } from "@/components/gravity/ExecutionCanvas";
import type { ExecutionRun, ExecutionNode, NodeStatus } from "@/lib/gravity/types";

interface ApiNode {
  id: string;
  name: string;
  type: string;
  status: string;
  stage: string;
  purpose: string;
  cost: number;
  tokens: number;
  latencyMs: number;
  confidence: number;
}

interface ApiRun {
  id: string;
  missionId: string;
  status: string;
  totalCost: number;
  totalTokens: number;
  totalLatencyMs: number;
  prompt: string | null;
  nodes: ApiNode[];
}

function apiNodeToExecutionNode(n: ApiNode, col: number): ExecutionNode {
  return {
    id: n.id,
    name: n.name,
    type: n.type,
    purpose: n.purpose,
    input: "",
    output: "",
    status: n.status as NodeStatus,
    durationMs: n.latencyMs,
    cost: n.cost,
    tokens: n.tokens,
    confidence: n.confidence,
    parents: [],
    column: col,
  };
}

function apiRunToExecutionRun(r: ApiRun): ExecutionRun {
  const stageMap = new Map<string, number>();
  let col = 0;
  const nodes = r.nodes.map((n) => {
    if (!stageMap.has(n.stage)) stageMap.set(n.stage, col++);
    return apiNodeToExecutionNode(n, stageMap.get(n.stage)!);
  });
  return {
    id: r.id,
    missionId: r.missionId,
    missionPrompt: r.prompt ?? "",
    nodes,
    status: r.status as ExecutionRun["status"],
    totalCost: r.totalCost,
    totalTokens: r.totalTokens,
    llmCalls: r.nodes.filter((n) => n.tokens > 0).length,
    startedAt: "",
  };
}

export default function ExecutionPage() {
  const [runs, setRuns] = React.useState<ApiRun[] | null>(null);
  const [selectedRun, setSelectedRun] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/executions", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.live && json.items.length > 0) {
          setRuns(json.items);
          setSelectedRun((prev) => prev ?? json.items[0].id);
        }
      } catch {
        /* keep empty */
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!runs || runs.length === 0) {
    return (
      <div className="p-8 lg:p-20">
        <div className="max-w-[1200px] mx-auto">
          <div className="mb-10">
            <div className="kicker-gold mb-3">Intelligence · Live</div>
            <h1 className="section-title mb-4">Execution <em>Canvas</em></h1>
            <p className="section-desc">
              Visual execution graph with node-by-node inspection and real-time status tracking.
            </p>
          </div>
          <Panel index="09" title="Execution Canvas">
            <p className="text-[13px] text-ivory-faint italic px-4 py-3">
              No executions yet — launch a mission from the home page and watch its nodes light up here in real time.
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  const apiRun = runs.find((r) => r.id === selectedRun) ?? runs[0];
  const execRun = apiRunToExecutionRun(apiRun);

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Intelligence · Live</div>
          <h1 className="section-title mb-4">Execution <em>Canvas</em></h1>
          <p className="section-desc">
            Visual execution graph with node-by-node inspection and real-time status tracking.
          </p>
        </div>

        {/* Run Selector */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
          {runs.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedRun(e.id)}
              className={`p-4 border text-left transition-colors flex-1 min-w-[220px] ${
                apiRun.id === e.id
                  ? "border-gold/30 bg-gold-pale"
                  : "border-border bg-deep hover:bg-surface"
              }`}
            >
              <div className="font-mono text-[8px] tracking-[0.15em] uppercase text-gold mb-1">{e.missionId?.slice(0, 8)}</div>
              <div className="text-xs text-ivory font-light truncate">{e.prompt ?? "—"}</div>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-mono text-[9px] text-ivory-faint">{e.nodes.length} nodes</span>
                <StatusDot status={e.status} />
              </div>
            </button>
          ))}
        </div>

        {/* Execution Canvas */}
        <ExecutionCanvas run={execRun} />
      </div>
    </div>
  );
}
