"use client";

import * as React from "react";
import { Panel, StatusDot, Bar } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";

interface ToolRow {
  id: string;
  name: string;
  type: string;
  permissions: string;
  latencyMs: number;
  successRate: number;
  status: string;
}

const FALLBACK_TOOLS: ToolRow[] = [
  { id: "T001", name: "Web Search", type: "Retrieval", permissions: "Read", latencyMs: 1250, successRate: 96, status: "active" },
  { id: "T002", name: "URL Fetch", type: "Retrieval", permissions: "Read", latencyMs: 850, successRate: 94, status: "active" },
  { id: "T003", name: "SQL Executor", type: "Data", permissions: "Read-only", latencyMs: 275, successRate: 99, status: "active" },
  { id: "T004", name: "Python REPL", type: "Compute", permissions: "Sandboxed", latencyMs: 2550, successRate: 92, status: "active" },
];

export default function ToolsPage() {
  const [rows, setRows] = React.useState<ToolRow[] | null>(null);

  React.useEffect(() => {
    fetch("/api/registry", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.live && Array.isArray(json.items) && json.items.length > 0) setRows(json.items);
      })
      .catch(() => {});
  }, []);

  const tools = rows ?? FALLBACK_TOOLS;

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="kicker-gold mb-3">Registry</div>
            <h1 className="section-title mb-4">Tool <em>Fabric</em></h1>
            <p className="section-desc">
              MCP-compatible tool registry. Each tool has scoped permissions, latency telemetry, and success rate tracking.
            </p>
          </div>
          <Button variant="outline">Add Tool</Button>
        </div>

        <div className="border border-border overflow-x-auto">
          <table className="w-full border-collapse bg-deep">
            <thead>
              <tr>
                {["Tool", "Type", "Permission", "Latency", "Success Rate", "Status"].map((h) => (
                  <th key={h} className="font-mono text-[8px] tracking-[0.18em] uppercase text-gold px-4 py-3 border-b border-border text-left bg-surface">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3 border-b border-border">
                    <div className="text-ivory font-light text-xs">{t.name}</div>
                    <div className="font-mono text-[9px] text-ivory-faint">{t.id}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-border">
                    <span className="font-mono text-[8px] px-2 py-0.5 border border-border-light text-ivory-faint">{t.type}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-ivory-dim text-xs">{t.permissions}</td>
                  <td className="px-4 py-3 border-b border-border font-mono text-[11px] text-ivory-faint text-center">{t.latencyMs >= 1000 ? `${(t.latencyMs / 1000).toFixed(1)}s` : `${t.latencyMs}ms`}</td>
                  <td className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Bar value={t.successRate} color={t.successRate > 95 ? "success" : t.successRate > 90 ? "gold" : "warning"} />
                      <span className="font-mono text-[10px] text-ivory-dim">{t.successRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-center">
                    <StatusDot status={t.status} />
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
