"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ESCALATION_LADDER } from "@/lib/gravity/data";
import { Meta, Panel } from "./primitives";

export function EscalationLadder({ activeLevel }: { activeLevel: number }) {
  const [selected, setSelected] = useState(activeLevel);
  const detail = ESCALATION_LADDER[selected]!;

  return (
    <Panel index="08" title="Escalation Ladder">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <ol className="relative">
          {ESCALATION_LADDER.map((l) => {
            const isActive = l.level === activeLevel;
            const isSelected = l.level === selected;
            const reached = l.level <= activeLevel;
            return (
              <li key={l.level} className="relative pl-8">
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[7px] top-4 h-full w-px",
                    l.level === ESCALATION_LADDER.length - 1 && "hidden",
                    reached ? "bg-gold/40" : "bg-border",
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-3 size-[15px] border",
                    isActive ? "border-gold bg-gold" : reached ? "border-gold/50 bg-background" : "border-border bg-background",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setSelected(l.level)}
                  aria-pressed={isSelected}
                  className={cn(
                    "block w-full border-b border-border/50 py-3 text-left transition-colors",
                    isSelected ? "text-ivory" : "text-ivory-dim hover:text-ivory",
                  )}
                >
                  <Meta className={cn(isActive && "text-gold")}>Level {l.level}</Meta>
                  <span className="mt-1 block text-sm tracking-tight">{l.name}</span>
                  {isActive ? (
                    <span className="meta mt-1 block text-gold">Active for this mission</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col justify-between gap-8">
          <div className="border border-border bg-surface/60 p-6">
            <Meta className="text-gold">Level {detail.level}</Meta>
            <h3 className="mt-3 font-display text-3xl leading-tight">{detail.name}</h3>
            <p className="mt-4 text-sm leading-relaxed text-ivory-dim">{detail.description}</p>
          </div>
          <blockquote className="border-l border-gold/40 pl-5">
            <p className="font-display text-xl leading-snug">
              GRAVITY does not begin with maximum intelligence. It escalates intelligence only when
              necessary.
            </p>
          </blockquote>
        </div>
      </div>
    </Panel>
  );
}
