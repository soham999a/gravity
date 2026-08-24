"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionNode, ExecutionRun, NodeStatus } from "@/lib/gravity/types";
import { KeyValue, Meta, Panel, SimulatedTag, dur, money, num } from "./primitives";

const statusTone: Record<NodeStatus, string> = {
  queued: "text-ivory-dim border-border",
  running: "text-gold border-gold",
  completed: "text-ivory border-gold/40",
  failed: "text-danger-text border-danger/50",
  escalated: "text-warning-text border-warning-text/50",
  skipped: "text-ivory-dim/60 border-border/50",
};

export function ExecutionCanvas({ run }: { run: ExecutionRun }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = run.nodes.find((n) => n.id === openId) ?? null;

  const columns = useMemo(() => {
    const map = new Map<number, ExecutionNode[]>();
    for (const n of run.nodes) {
      const list = map.get(n.column) ?? [];
      list.push(n);
      map.set(n.column, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [run.nodes]);

  return (
    <Panel
      index="09"
      title="Execution Canvas"
      aside={
        <div className="flex items-center gap-3">
          <Meta>{run.llmCalls} LLM calls</Meta>
          <SimulatedTag />
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="-mx-5 overflow-x-auto px-5 pb-2">
          <div className="min-w-[640px] space-y-0">
            {columns.map(([col, nodes], idx) => (
              <div key={col}>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${nodes.length}, minmax(0,1fr))` }}>
                  {nodes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setOpenId(n.id)}
                      aria-expanded={openId === n.id}
                      className={cn(
                        "group border bg-surface/50 p-4 text-left transition-all hover:bg-surface",
                        statusTone[n.status],
                        openId === n.id && "bg-gold/[0.06]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Meta>{n.type}</Meta>
                        <span
                          className={cn(
                            "meta",
                            n.status === "running" && "animate-pulse text-gold",
                            n.status === "completed" && "text-success-text",
                            n.status === "escalated" && "text-warning-text",
                            n.status === "failed" && "text-danger-text",
                          )}
                        >
                          {n.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm tracking-tight">{n.name}</p>
                      {n.status !== "queued" ? (
                        <p className="mt-2 font-mono text-[0.65rem] tabular-nums text-ivory-dim">
                          {dur(n.durationMs)} · {num(n.tokens)} tok · {money(n.cost)}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
                {idx < columns.length - 1 ? (
                  <div className="flex justify-center py-2" aria-hidden>
                    <svg width="2" height="28" className="overflow-visible">
                      <line
                        x1="1"
                        y1="0"
                        x2="1"
                        y2="28"
                        stroke="var(--color-gold-dim)"
                        strokeWidth="1"
                        className={run.status === "running" ? "flow-line" : ""}
                      />
                    </svg>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <aside className="border border-border bg-surface/60 p-5" aria-live="polite">
          {open ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Meta className="text-gold">{open.type}</Meta>
                  <h3 className="mt-2 font-display text-2xl leading-tight">{open.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  aria-label="Close node detail"
                  className="grid size-7 shrink-0 place-items-center border border-border text-ivory-dim hover:text-ivory"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ivory-dim">{open.purpose}</p>
              <div className="mt-5">
                <KeyValue label="Status" value={open.status.toUpperCase()} tone="gold" />
                <KeyValue label="Input" value={open.input} />
                <KeyValue label="Output" value={open.output} />
                <KeyValue label="Execution time" value={dur(open.durationMs)} />
                <KeyValue label="Cost" value={money(open.cost)} />
                <KeyValue label="Tokens" value={num(open.tokens)} />
                <KeyValue label="Confidence" value={`${open.confidence}%`} />
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
              <Meta>Node Inspector</Meta>
              <p className="mt-3 max-w-[18rem] text-xs leading-relaxed text-ivory-dim">
                Select any node in the execution canvas to inspect its purpose, inputs, outputs,
                cost and confidence.
              </p>
            </div>
          )}
        </aside>
      </div>
    </Panel>
  );
}
