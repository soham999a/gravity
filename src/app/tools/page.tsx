"use client";

import { Panel, StatusDot, Bar } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";

const TOOLS = [
  { id: "T001", name: "Web Search", type: "Retrieval", permission: "Read", latency: "500-2000ms", successRate: 96, status: "active" },
  { id: "T002", name: "URL Fetch", type: "Retrieval", permission: "Read", latency: "200-1500ms", successRate: 94, status: "active" },
  { id: "T003", name: "SQL Executor", type: "Data", permission: "Read-only", latency: "50-500ms", successRate: 99, status: "active" },
  { id: "T004", name: "Python REPL", type: "Compute", permission: "Sandboxed", latency: "100-5000ms", successRate: 92, status: "active" },
  { id: "T005", name: "Chart Renderer", type: "Output", permission: "Write", latency: "200-800ms", successRate: 98, status: "active" },
  { id: "T006", name: "Document Reader", type: "Retrieval", permission: "Read", latency: "50-200ms", successRate: 99, status: "active" },
  { id: "T007", name: "File I/O", type: "Storage", permission: "Scoped R/W", latency: "10-100ms", successRate: 99, status: "active" },
  { id: "T008", name: "HTTP Client", type: "Integration", permission: "Scoped", latency: "100-3000ms", successRate: 93, status: "active" },
  { id: "T009", name: "OCR Engine", type: "Vision", permission: "Read", latency: "500-2000ms", successRate: 89, status: "active" },
  { id: "T010", name: "Optimizer (OR-Tools)", type: "Compute", permission: "None", latency: "100-10000ms", successRate: 97, status: "active" },
];

export default function ToolsPage() {
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
              {TOOLS.map((t) => (
                <tr key={t.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3 border-b border-border">
                    <div className="text-ivory font-light text-xs">{t.name}</div>
                    <div className="font-mono text-[9px] text-ivory-faint">{t.id}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-border">
                    <span className="font-mono text-[8px] px-2 py-0.5 border border-border-light text-ivory-faint">{t.type}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-ivory-dim text-xs">{t.permission}</td>
                  <td className="px-4 py-3 border-b border-border font-mono text-[11px] text-ivory-faint text-center">{t.latency}</td>
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
