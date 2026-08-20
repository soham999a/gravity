"use client";

import { Panel, Bar } from "@/components/gravity/primitives";

const STRATEGY_SPEND = [
  { strategy: "Deterministic", executions: 42, cost: 0, tokens: 0, pct: 42 },
  { strategy: "Statistical/ML", executions: 21, cost: 0, tokens: 0, pct: 21 },
  { strategy: "Small LLM (local)", executions: 22, cost: 0.044, tokens: 44000, pct: 22 },
  { strategy: "Specialist Agent", executions: 10, cost: 0.06, tokens: 32000, pct: 10 },
  { strategy: "Multi-Agent", executions: 5, cost: 0.08, tokens: 60000, pct: 5 },
];

export default function CostPage() {
  const totalExecutions = STRATEGY_SPEND.reduce((a, b) => a + b.executions, 0);
  const totalCost = STRATEGY_SPEND.reduce((a, b) => a + b.cost, 0);
  const totalTokens = STRATEGY_SPEND.reduce((a, b) => a + b.tokens, 0);
  const llmAvoidance = ((STRATEGY_SPEND[0].executions + STRATEGY_SPEND[1].executions) / totalExecutions * 100).toFixed(0);

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Observability</div>
          <h1 className="section-title mb-4">Intelligence <em>Economy</em></h1>
          <p className="section-desc">
            Cost breakdown by strategy class, LLM avoidance rate, and counterfactual comparison.
          </p>
        </div>

        {/* Headline KPIs */}
        <div className="grid-4 mb-10">
          <div>
            <div className="kicker mb-1">Total Executions</div>
            <div className="font-serif text-3xl font-light text-gold">{totalExecutions}</div>
          </div>
          <div>
            <div className="kicker mb-1">Total Spend</div>
            <div className="font-serif text-3xl font-light text-gold">${totalCost.toFixed(3)}</div>
          </div>
          <div>
            <div className="kicker mb-1">Avg Cost/Task</div>
            <div className="font-serif text-3xl font-light text-gold">${(totalCost / totalExecutions).toFixed(3)}</div>
          </div>
          <div>
            <div className="kicker mb-1">LLM Avoidance</div>
            <div className="font-serif text-3xl font-light text-success-text">{llmAvoidance}%</div>
          </div>
        </div>

        {/* Strategy Spend */}
        <Panel title="Spend by Strategy Class" className="mb-10">
          <div className="space-y-3">
            {STRATEGY_SPEND.map((s) => (
              <div key={s.strategy} className="flex items-center gap-4">
                <span className="w-[200px] shrink-0 font-mono text-[9px] tracking-[0.1em] uppercase text-ivory-faint">{s.strategy}</span>
                <div className="flex-1 h-[18px] bg-border">
                  <div
                    className={`h-full flex items-center pl-2 font-mono text-[8px] ${
                      s.cost === 0 ? "bg-success/20 text-success-text" : "bg-gold/20 text-gold"
                    }`}
                    style={{ width: `${s.pct}%` }}
                  >
                    {s.executions} tasks
                  </div>
                </div>
                <span className="font-mono text-[10px] w-16 text-right" style={{ color: s.cost === 0 ? "var(--color-success-text)" : "var(--color-ivory-dim)" }}>
                  ${s.cost.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Counterfactual */}
        <div className="grid grid-cols-2 gap-6 mb-10">
          <Panel title="GRAVITY Approach">
            <div className="text-center p-6 border border-success/20 bg-success/5">
              <div className="font-serif text-4xl font-light text-success-text mb-2">${totalCost.toFixed(3)}</div>
              <div className="text-sm text-ivory-faint">Total cost across {totalExecutions} tasks</div>
              <div className="text-[11px] text-ivory-faint mt-1">{totalTokens.toLocaleString()} tokens consumed</div>
            </div>
          </Panel>
          <Panel title="Counterfactual: All LLM">
            <div className="text-center p-6 border border-danger/20 bg-danger/5">
              <div className="font-serif text-4xl font-light text-danger-text mb-2">${(totalExecutions * 0.015).toFixed(2)}</div>
              <div className="text-sm text-ivory-faint">If all {totalExecutions} tasks used LLM @ $0.015/task</div>
              <div className="text-[11px] text-ivory-faint mt-1">{(totalExecutions * 8000).toLocaleString()} tokens (estimated)</div>
            </div>
          </Panel>
        </div>

        {/* Savings */}
        <div className="text-center border border-border bg-gold-pale2 p-12">
          <div className="kicker-gold mb-3">Cost Savings</div>
          <div className="font-serif text-5xl font-light text-gold mb-2">
            {((1 - totalCost / (totalExecutions * 0.015)) * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-ivory-faint">
            GRAVITY saves ${((totalExecutions * 0.015) - totalCost).toFixed(2)} across {totalExecutions} tasks
            by routing {llmAvoidance}% of tasks away from LLMs
          </div>
        </div>
      </div>
    </div>
  );
}
