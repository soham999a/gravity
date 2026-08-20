"use client";

import { SectionBlock, Panel } from "@/components/gravity/primitives";

const STAGES = [
  { num: "01", input: "50,000 raw documents received", action: "Filter duplicates", reduction: "" },
  { num: "02", input: "Remove exact and near-duplicates", action: "Embed locally (Nomic, zero cost)", reduction: "→ 38,000 (24% reduction)" },
  { num: "03", input: "Embed all documents locally", action: "K-means clustering", reduction: "→ 38,000 embeddings" },
  { num: "04", input: "Cluster into topic groups", action: "Identify 42 distinct themes", reduction: "→ 42 clusters" },
  { num: "05", input: "Extract cluster summaries", action: "Statistical summarization per cluster", reduction: "→ 42 summaries" },
  { num: "06", input: "Merge similar clusters", action: "Semantic similarity merge", reduction: "→ 18 evidence groups" },
  { num: "07", input: "Select representative documents", action: "Pick top-2 per group", reduction: "→ 36 key documents" },
  { num: "08", input: "Structure evidence groups", action: "Format for LLM context", reduction: "→ 18 structured evidence packs" },
  { num: "09", input: "LLM synthesises evidence", action: "Targeted LLM synthesis on 18 groups", reduction: "→ Final insight report" },
];

export default function CompressionPage() {
  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Core Concept</div>
          <h1 className="section-title mb-4">Intelligence <em>Compression</em></h1>
          <p className="section-desc">
            Rather than sending raw data to an LLM, GRAVITY compresses the intelligence requirement first —
            achieving up to 93% token reduction with cleaner output.
          </p>
        </div>

        {/* Before / After */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="p-6 border border-danger/20 bg-deep border-l-[3px] border-l-danger">
            <div className="kicker text-danger-text mb-3">Naive Approach</div>
            <div className="font-serif text-xl text-ivory mb-2">50,000 documents to LLM directly</div>
            <div className="text-xs text-ivory-faint leading-relaxed">
              Context: ~5,000,000 tokens. Cost: ~$15.00. Noisy context degrades quality.
              Rate limits hit. Timeout risk. Hallucination increases with context length.
            </div>
          </div>
          <div className="p-6 border border-success/20 bg-deep border-l-[3px] border-l-success">
            <div className="kicker text-success-text mb-3">GRAVITY Approach</div>
            <div className="font-serif text-xl text-ivory mb-2">18 evidence groups to LLM</div>
            <div className="text-xs text-ivory-faint leading-relaxed">
              Context: ~50,000 tokens. Cost: ~$0.15. 99% cost reduction. Cleaner output.
              Focused synthesis. Higher quality per token. Deterministic pipeline before LLM.
            </div>
          </div>
        </div>

        {/* Pipeline */}
        <Panel title="Compression Pipeline — 9 Stages">
          <div className="space-y-0">
            {STAGES.map((s, i) => (
              <div key={i}>
                <div className="grid grid-cols-[60px_1fr_200px] border border-border bg-void">
                  <div className="px-4 py-3 border-r border-border flex items-center justify-center">
                    <span className="font-mono text-[11px] text-gold">{s.num}</span>
                  </div>
                  <div className="px-5 py-3 text-[12px] text-ivory-dim flex items-center">{s.input}</div>
                  <div className="px-4 py-3 border-l border-border flex items-center">
                    <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-ivory-faint">{s.action}</span>
                  </div>
                </div>
                {s.reduction && (
                  <div className="px-5 py-1.5 bg-void border-x border-border text-[10px] text-gold font-mono">
                    {s.reduction}
                  </div>
                )}
                {i < STAGES.length - 1 && (
                  <div className="text-center py-1 bg-void border-x border-border font-mono text-[10px] text-gold-dim">
                    ↓
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>

        {/* KPIs */}
        <div className="grid-4 mt-10">
          <div>
            <div className="kicker mb-1">Input Documents</div>
            <div className="font-serif text-3xl font-light text-gold">50,000</div>
          </div>
          <div>
            <div className="kicker mb-1">Output Groups</div>
            <div className="font-serif text-3xl font-light text-gold">18</div>
          </div>
          <div>
            <div className="kicker mb-1">Token Reduction</div>
            <div className="font-serif text-3xl font-light text-success-text">99%</div>
          </div>
          <div>
            <div className="kicker mb-1">Cost Savings</div>
            <div className="font-serif text-3xl font-light text-success-text">$14.85</div>
          </div>
        </div>
      </div>
    </div>
  );
}
