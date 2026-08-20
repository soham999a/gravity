"use client";

import { Panel, StatusDot, Bar } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";

const MODELS = [
  { id: "M001", name: "Llama 3.3 70B", provider: "Meta (Ollama)", capability: "Advanced Reasoning", costPerToken: 0, latency: "5-30s", context: "128K", quality: 88, placement: "local", status: "active" },
  { id: "M002", name: "Mistral 7B", provider: "Mistral (Ollama)", capability: "General + Code", costPerToken: 0, latency: "0.5-4s", context: "32K", quality: 78, placement: "local", status: "active" },
  { id: "M003", name: "Llama 3.2 3B", provider: "Meta (Ollama)", capability: "Lightweight Tasks", costPerToken: 0, latency: "0.3-2s", context: "16K", quality: 68, placement: "local", status: "active" },
  { id: "M004", name: "Qwen 2.5 1.5B", provider: "Alibaba (Ollama)", capability: "Ultra-Lightweight", costPerToken: 0, latency: "0.2-1s", context: "8K", quality: 58, placement: "local", status: "active" },
  { id: "M005", name: "Qwen 2.5 VL", provider: "Alibaba (Ollama)", capability: "Vision + Language", costPerToken: 0, latency: "1-5s", context: "32K", quality: 82, placement: "local", status: "active" },
  { id: "M006", name: "Nomic Embed", provider: "Nomic (local)", capability: "Embeddings", costPerToken: 0, latency: "10-50ms", context: "8K", quality: 85, placement: "local", status: "active" },
  { id: "M007", name: "GPT-4o", provider: "OpenAI (Cloud)", capability: "Advanced General", costPerToken: 0.000005, latency: "2-15s", context: "128K", quality: 95, placement: "cloud", status: "active" },
  { id: "M008", name: "Claude 3.5 Sonnet", provider: "Anthropic (Cloud)", capability: "Analysis + Code", costPerToken: 0.000003, latency: "2-12s", context: "200K", quality: 93, placement: "cloud", status: "active" },
];

export default function ModelsPage() {
  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="kicker-gold mb-3">Registry</div>
            <h1 className="section-title mb-4">Model <em>Registry</em></h1>
            <p className="section-desc">
              Provider-agnostic model catalog. Ollama primary. Cloud optional for verified edge cases only.
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
              {MODELS.map((m) => (
                <tr key={m.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3 border-b border-border text-ivory font-light text-xs">{m.name}</td>
                  <td className="px-4 py-3 border-b border-border text-ivory-dim text-xs">{m.provider}</td>
                  <td className="px-4 py-3 border-b border-border text-ivory-faint text-xs">{m.capability}</td>
                  <td className="px-4 py-3 border-b border-border font-mono text-xs text-center" style={{ color: m.costPerToken === 0 ? "var(--color-success-text)" : "var(--color-ivory-dim)" }}>
                    {m.costPerToken === 0 ? "$0.00" : `$${m.costPerToken}`}
                  </td>
                  <td className="px-4 py-3 border-b border-border font-mono text-[11px] text-ivory-faint text-center">{m.latency}</td>
                  <td className="px-4 py-3 border-b border-border font-mono text-[11px] text-ivory-faint text-center">{m.context}</td>
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
