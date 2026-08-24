"use client";

import * as React from "react";
import { SectionBlock, Panel, Badge } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Plus, ExternalLink, Loader2 } from "lucide-react";

const MISSIONS = [
  { id: "MS-001", prompt: "Demand forecasting — next 30 days", domain: "Retail", dataType: "time_series", strategy: "statistical", escalation: 1, llmCalls: 0, tokens: 0, cost: "$0.00", latency: "3.2s", confidence: 93, status: "completed" },
  { id: "MS-002", prompt: "Summarise 50 customer complaints", domain: "Support", dataType: "documents", strategy: "small_llm", escalation: 2, llmCalls: 3, tokens: 4200, cost: "$0.003", latency: "12.4s", confidence: 87, status: "completed" },
  { id: "MS-003", prompt: "Analyse 12% quarterly sales decline", domain: "Finance", dataType: "structured", strategy: "multi_agent", escalation: 5, llmCalls: 7, tokens: 18400, cost: "$0.018", latency: "21s", confidence: 91, status: "completed" },
  { id: "MS-004", prompt: "Research Oman real estate market", domain: "Research", dataType: "text", strategy: "multi_agent", escalation: 5, llmCalls: 9, tokens: 24000, cost: "$0.024", latency: "45s", confidence: 84, status: "completed" },
  { id: "MS-005", prompt: "Detect anomalies in transactions", domain: "Finance", dataType: "structured", strategy: "deterministic", escalation: 1, llmCalls: 0, tokens: 0, cost: "$0.00", latency: "0.8s", confidence: 96, status: "completed" },
  { id: "MS-006", prompt: "Generate product listing from photo", domain: "E-commerce", dataType: "images", strategy: "specialist_agent", escalation: 3, llmCalls: 2, tokens: 5600, cost: "$0.006", latency: "8.1s", confidence: 89, status: "completed" },
  { id: "MS-007", prompt: "Optimise delivery routes for 150 stops", domain: "Logistics", dataType: "structured", strategy: "deterministic", escalation: 0, llmCalls: 0, tokens: 0, cost: "$0.00", latency: "1.2s", confidence: 98, status: "completed" },
  { id: "MS-008", prompt: "Answer product FAQ from knowledge base", domain: "Support", dataType: "text", strategy: "small_llm", escalation: 2, llmCalls: 1, tokens: 800, cost: "$0.001", latency: "1.5s", confidence: 92, status: "completed" },
];

interface LiveMissionRow {
  id: string;
  prompt: string;
  domain: string | null;
  dataType: string | null;
  selectedStrategy: string | null;
  totalTokens: number | null;
  totalLatencyMs: number | null;
  confidence: number | null;
  status: string;
}

export default function MissionsPage() {
  const [liveMissions, setLiveMissions] = React.useState<LiveMissionRow[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/missions", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { missions: LiveMissionRow[] };
        if (!cancelled) setLiveMissions(data.missions);
      } catch {
        // stay on mock data
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const isLive = liveMissions !== null;
  const rows = isLive
    ? liveMissions!.map((m) => ({
        id: m.id.slice(0, 8).toUpperCase(),
        prompt: m.prompt,
        domain: m.domain ?? "—",
        dataType: m.dataType ?? "—",
        strategy: (m.selectedStrategy ?? "pending") as string,
        tokens: m.totalTokens ?? 0,
        cost: "$0.00",
        latency: m.totalLatencyMs ? `${(m.totalLatencyMs / 1000).toFixed(1)}s` : "—",
        confidence: m.confidence != null ? Math.round(m.confidence * 100) : null,
        status: m.status,
      }))
    : MISSIONS.map((m) => ({ ...m }));

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="kicker-gold mb-3">Mission Control</div>
            <h1 className="section-title mb-4">Mission <em>Library</em></h1>
            <p className="section-desc">All intelligence missions processed by GRAVITY with full traceability.</p>
          </div>
          <Button>
            <Plus size={14} className="mr-2" /> New Mission
          </Button>
        </div>

        {/* Stats */}
        <div className="grid-4 mb-10">
          <div>
            <div className="kicker mb-1">Total Missions</div>
            <div className="font-serif text-3xl font-light text-gold">{rows.length}</div>
          </div>
          {isLive ? (
            <>
              <div>
                <div className="kicker mb-1">Total Tokens</div>
                <div className="font-serif text-3xl font-light text-gold">
                  {rows.reduce((s, r) => s + (("tokens" in r ? r.tokens : 0) as number), 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="kicker mb-1">Avg Latency</div>
                <div className="font-serif text-3xl font-light text-gold">
                  {(() => {
                    const lat = liveMissions!.filter((m) => m.totalLatencyMs);
                    return lat.length
                      ? `${(lat.reduce((s, m) => s + (m.totalLatencyMs ?? 0), 0) / lat.length / 1000).toFixed(1)}s`
                      : "—";
                  })()}
                </div>
              </div>
              <div>
                <div className="kicker mb-1">LLM Avoidance</div>
                <div className="font-serif text-3xl font-light text-gold">
                  {liveMissions!.length
                    ? `${Math.round((liveMissions!.filter((m) => !m.totalTokens).length / liveMissions!.length) * 100)}%`
                    : "—"}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="kicker mb-1">Avg Cost</div>
                <div className="font-serif text-3xl font-light text-gold">$0.006</div>
              </div>
              <div>
                <div className="kicker mb-1">Avg Latency</div>
                <div className="font-serif text-3xl font-light text-gold">11.5s</div>
              </div>
              <div>
                <div className="kicker mb-1">LLM Avoidance</div>
                <div className="font-serif text-3xl font-light text-gold">37%</div>
              </div>
            </>
          )}
        </div>

        {!isLive && (
          <div className="flex items-center gap-2.5 mb-5 px-4 py-3 border border-border bg-deep">
            <Loader2 size={12} className="animate-spin text-gold" />
            <span className="kicker mb-0">
              Demo registry — connect the database to see live missions here.
            </span>
          </div>
        )}

        {/* Table */}
        <div className="border border-border overflow-x-auto">
          <table className="w-full border-collapse bg-deep">
            <thead>
              <tr>
                {["ID", "Task", "Domain", "Data Type", "Strategy", isLive ? "Tokens" : "LLM Calls", "Cost", "Latency", "Confidence", "Status"].map((h) => (
                  <th key={h} className="font-mono text-[8px] tracking-[0.18em] uppercase text-gold px-4 py-3 border-b border-border text-left bg-surface">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const r = m as Record<string, unknown>;
                return (
                  <tr key={String(r.id)} className="hover:bg-surface transition-colors">
                    <td className="px-4 py-3 border-b border-border text-ivory font-mono text-xs">{String(r.id)}</td>
                    <td className="px-4 py-3 border-b border-border text-ivory font-light text-xs max-w-[280px] truncate">{String(r.prompt)}</td>
                    <td className="px-4 py-3 border-b border-border text-ivory-dim text-xs">{String(r.domain)}</td>
                    <td className="px-4 py-3 border-b border-border text-ivory-dim text-xs">{String(r.dataType)}</td>
                    <td className="px-4 py-3 border-b border-border"><Badge strategy={String(r.strategy)} variant="strategy">{String(r.strategy)}</Badge></td>
                    <td className="px-4 py-3 border-b border-border font-mono text-xs text-center" style={{ color: Number(r.tokens) === 0 || r.llmCalls === 0 ? "var(--color-success-text)" : "var(--color-ivory-dim)" }}>
                      {"llmCalls" in r ? String(r.llmCalls) : String(r.tokens)}
                    </td>
                    <td className="px-4 py-3 border-b border-border font-mono text-xs text-center" style={{ color: r.cost === "$0.00" ? "var(--color-success-text)" : "var(--color-ivory-dim)" }}>{String(r.cost)}</td>
                    <td className="px-4 py-3 border-b border-border font-mono text-xs text-ivory-faint text-center">{String(r.latency)}</td>
                    <td className="px-4 py-3 border-b border-border font-mono text-xs text-ivory-dim text-center">
                      {r.confidence == null ? "—" : `${r.confidence}%`}
                    </td>
                    <td className="px-4 py-3 border-b border-border text-center">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                          r.status === "completed" || r.status === "succeeded"
                            ? "bg-success-text"
                            : r.status === "failed"
                              ? "bg-danger-text"
                              : "bg-gold animate-pulse"
                        }`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
