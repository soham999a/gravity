"use client";

import * as React from "react";
import { ChevronDown, GitCompareArrows, LoaderCircle } from "lucide-react";
import { SectionedBrief } from "./ResultPortal";

export interface CompareWith {
  otherId: string;
  selfTag: string;
  otherTag: string;
}

interface OtherNode {
  status: string | null;
  output: string | null;
  tokens: number | null;
}

/**
 * COMPARE RUNS — side-by-side view of the current run against the run it
 * was simulated from (or the simulation it spawned). Loads the other run's
 * output on first open; toggles after that.
 */
export function ComparePanel({
  selfTitle,
  selfOutput,
  compareWith,
}: {
  selfTitle: string;
  selfOutput: string;
  compareWith: CompareWith | null | undefined;
}) {
  const [open, setOpen] = React.useState(false);
  const [other, setOther] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  if (!compareWith) return null;

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (other != null || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/missions/${compareWith.otherId}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = (await res.json()) as { nodes?: OtherNode[] };
      const nodes = json.nodes ?? [];
      const synth =
        [...nodes].reverse().find((n) => n.status === "completed" && (n.tokens ?? 0) > 0) ??
        [...nodes].reverse().find((n) => n.output);
      setOther(synth?.output ?? "");
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`result-compare-wrap ${open ? "result-compare-wrap-open" : ""}`}>
      <button
        type="button"
        className="studio-secondary-button"
        onClick={() => void toggle()}
        aria-expanded={open}
      >
        {loading ? <LoaderCircle className="size-3.5 animate-spin" /> : <GitCompareArrows className="size-3.5" />}
        {loading ? "Loading other run…" : open ? "Hide comparison" : `Compare · ${compareWith.otherTag} vs ${compareWith.selfTag}`}
        <ChevronDown className="result-trace-chevron" />
      </button>
      {open ? (
        failed ? (
          <p className="studio-muted mt-3">Could not load the other run — it may have been deleted.</p>
        ) : other == null ? (
          <p className="studio-muted mt-3 flex items-center gap-2">
            <LoaderCircle className="size-3.5 animate-spin" /> Loading…
          </p>
        ) : (
          <div className="result-compare">
            <div className="result-compare-col">
              <p className="studio-eyebrow">{compareWith.selfTag} · THIS RUN</p>
              <h4 className="result-compare-title">{selfTitle}</h4>
              <SectionedBrief markdown={selfOutput} />
            </div>
            <div className="result-compare-col">
              <p className="studio-eyebrow">{compareWith.otherTag}</p>
              <h4 className="result-compare-title">Other run</h4>
              <SectionedBrief markdown={other} />
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
