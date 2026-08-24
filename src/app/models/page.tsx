"use client";

import { Panel, StatusDot, Bar } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";
import * as React from "react";
import { useLiveData } from "@/hooks/useLiveData";

interface ModelRow {
  id: string;
  name: string;
  provider: string;
  capability: string;
  costPerToken: number;
  latencyMs: number;
  contextWindow: number;
  quality: number;
  placement: string;
  status: string;
}

const FALLBACK_MODELS: ModelRow[] = [
  { id: "M001", name: "Gemini 2.5 Flash", provider: "Google (cloud)", capability: "General Reasoning", costPerToken: 0, latencyMs: 2500, contextWindow: 1048576, quality: 90, placement: "cloud", status: "active" },
  { id: "M002", name: "Gemini 2.5 Flash-Lite", provider: "Google (cloud)", capability: "Fast Synthesis", costPerToken: 0, latencyMs: 1200, contextWindow: 1048576, quality: 82, placement: "cloud", status: "active" },
  { id: "M003", name: "Llama 3.3 70B (Groq)", provider: "Groq (cloud)", capability: "Advanced Reasoning", costPerToken: 0, latencyMs: 900, contextWindow: 131072, quality: 88, placement: "cloud", status: "active" },
  { id: "M004", name: "Nomic Embed", provider: "Local", capability: "Embeddings", costPerToken: 0, latencyMs: 40, contextWindow: 8192, quality: 90, placement: "local", status: "active" },
];

function fmtContext(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export default function ModelsPage() {
  const { data: liveModels } = useLiveData<ModelRow>("/api/models", 15000);
  const rows = liveModels ?? FALLBACK_MODELS;
  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="kicker-gold mb-3">Registry</div>
            <h1 className="section-title mb-4">Model <em>Registry</em></h1>
            <p className="section-desc">
              Provider-agnostic model catalog. Free cloud inference primary (Gemini + Groq). Zero-cost missions by design.
            </p>
          </div>
          <Button variant="outline">Register Model</Button>
        </div>

        <div className="border border-border overflow-x-auto">
          <table className="w-full border-collapse bg-deep">
            <thead>
              <tr>
                {["Model", "Provider", "Capability", "Cost/Token", "Latency", "Context", "Quality", "Placement", "Status"].map((h) => (
                  <th key={h} className="font-mono text-[8px] tracking-[0.18em] uppercase text-gold px-4 py-3 border-b border-border text-left bg-surface">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3 border-b border-border text-ivory font-light text-xs">{m.name}</td>
                  <td className="px-4 py-3 border-b border-border text-ivory-dim text-xs">{m.provider}</td>
                  <td className="px-4 py-3 border-b border-border text-ivory-faint text-xs">{m.capability}</td>
                  <td className="px-4 py-3 border-b border-border font-mono text-xs text-center" style={{ color: m.costPerToken === 0 ? "var(--color-success-text)" : "var(--color-ivory-dim)" }}>
                    {m.costPerToken === 0 ? "$0.00" : `$${m.costPerToken}`}
                  </td>
                  <td className="px-4 py-3 border-b border-border font-mono text-[11px] text-ivory-faint text-center">{m.latencyMs >= 1000 ? `${(m.latencyMs / 1000).toFixed(1)}s` : `${m.latencyMs}ms`}</td>
                  <td className="px-4 py-3 border-b border-border font-mono text-[11px] text-ivory-faint text-center">{fmtContext(m.contextWindow)}</td>
                  <td className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Bar value={m.quality} color={m.quality > 85 ? "success" : m.quality > 70 ? "gold" : "warning"} />
                      <span className="font-mono text-[10px] text-ivory-dim">{m.quality}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-center">
                    <span className={`font-mono text-[9px] px-2 py-0.5 border ${
                      m.placement === "local"
                        ? "border-success/30 text-success-text"
                        : "border-warning/30 text-warning-text"
                    }`}>
                      {m.placement}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-center">
                    <StatusDot status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
