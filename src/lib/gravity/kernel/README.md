# GRAVITY Adaptive Kernel

Ported from the intelligence-fabric research build. This is the brain that replaces
the static suitability-score table in `pipeline.ts`.

## What lives here

| Module | Role |
|---|---|
| `problemState.ts` | UPSP-style deep problem profiler → structured `ProblemState` (intent, data, complexity, uncertainty, risk, quality, latency) |
| `capabilities.ts` | Enterprise capability registry — policy-filtered discovery from `ProblemState` |
| `routing.ts` | Contextual **Thompson Sampling** router: Bayesian posteriors per route, context features, exploration boosts, regime-shift detection, reward learning |

## The one call site

`pipeline.ts` → `routeStrategyAdaptive(profile)` — same return shape as the old
`routeStrategy`, so missions, receipts and the ledger are unchanged. The difference:
routing decisions now come from a learning policy that updates itself from every
mission outcome (`recordRouteOutcome`), instead of a hand-tuned score table.

## Learning loop

```
profile → ProblemState → capability discovery → candidate routes
        → Thompson sample → best route → mission executes
        → outcome (status/quality/latency) → posterior update
        → next mission routes better
```

Regime-shift detection halves posterior precision when recent rewards drift, so the
policy re-explores instead of exploiting stale beliefs.
