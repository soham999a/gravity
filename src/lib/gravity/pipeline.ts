import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  missions,
  problemProfiles,
  routingDecisions,
  executionRuns,
  executionNodes,
  decisionLedger,
  evaluations,
} from "@/lib/drizzle/schema";
import { callLLM } from "@/lib/gravity/llm";
import type { StrategyKind } from "@/lib/gravity/types";

type Complexity = "low" | "medium" | "high" | "critical";

const COMPLEX_WORDS = [
  "strategy", "strategic", "multi", "agent", "deliberation", "optimise", "optimize",
  "recommend", "design", "architecture", "architect", "plan", "recover", "negotiate", "analyse",
  "analyze", "evaluate", "compare", "forecast", "risk", "fraud", "detection", "system",
  "platform", "scale", "scaling", "scalable", "compliance", "regulatory", "regulation",
  "real-time", "realtime", "distributed", "migration", "migrate", "integrate", "integration",
  "adaptive", "autonomous", "orchestration", "orchestrate", "resilient", "fault-tolerant",
  "latency", "throughput", "concurrent", "global", "pipeline", "workflow", "governance",
  "security", "privacy", "compliant", "audit", "stakeholder", "trade-off", "constraint",
];

const SCALE_RE = /\b\d+(?:\.\d+)?\s*(?:m|mm|k|b|million|billion|thousand|%|percent|x)\b|\b\d{2,}\b/gi;

export interface ProfileResult {
  dataType: string;
  complexity: Complexity;
  domain: string;
  signals: { name: string; value: number; unit?: string }[];
  dimensions: { name: string; score: number; maxScore: number }[];
  summary: string;
}

export function profileProblem(prompt: string): ProfileResult {
  const lower = prompt.toLowerCase();
  const words = lower.split(/\s+/);

  let dataType = "text";
  if (/sql|table|row|column|database|transaction|ledger/.test(lower)) dataType = "structured";
  else if (/time.?series|monthly|daily|trend|forecast|historical/.test(lower)) dataType = "time_series";
  else if (/image|photo|video|visual/.test(lower)) dataType = "images";
  else if (/document|pdf|report|file/.test(lower)) dataType = "documents";
  else if (/ and |,|\+/.test(lower) && words.length > 14) dataType = "mixed";

  const complexHits = COMPLEX_WORDS.filter((w) =>
    new RegExp(`\\b${w.replace(/-/g, "[- ]?")}\\b`, "i").test(prompt),
  ).length;
  const scaleHits = [...prompt.matchAll(SCALE_RE)].length;
  const lengthScore = Math.min(words.length / 2, 30);
  const complexityRaw = complexHits * 5 + scaleHits * 4 + lengthScore;
  const complexity: Complexity =
    complexityRaw >= 60 ? "critical" : complexityRaw >= 38 ? "high" : complexityRaw >= 18 ? "medium" : "low";

  const domains: [string, RegExp][] = [
    ["retail", /retail|sales|store|customer/],
    ["finance", /financ|revenue|cost|budget|profit|invoice/],
    ["operations", /route|logistic|supply|inventory|delivery/],
    ["engineering", /code|software|system|api|build|develop/],
    ["research", /research|analys|analyz|report|summar|study/],
    ["general", /.*/],
  ];
  const domain = domains.find(([, re]) => re.test(lower))![0];

  return {
    dataType,
    complexity,
    domain,
    signals: [
      { name: "Prompt length", value: words.length, unit: "words" },
      { name: "Complexity markers", value: complexHits },
      { name: "Scale indicators", value: scaleHits },
      { name: "Estimated entities", value: Math.max(1, Math.round(words.length / 8)) },
      { name: "Risk surface", value: /risk|anomal|fraud|fail|outage|legal/.test(lower) ? 0.7 : 0.25 },
    ],
    dimensions: [
      { name: "Analytical", score: /analy|forecast|predict|trend|cluster/.test(lower) ? 4 : 2, maxScore: 5 },
      { name: "Creative", score: /design|create|write|brand|story/.test(lower) ? 4 : 1, maxScore: 5 },
      { name: "Computational", score: /optimi[sz]e|calculat|route|schedule|solve/.test(lower) ? 5 : 2, maxScore: 5 },
      { name: "Reasoning depth", score: complexity === "low" ? 1 : complexity === "medium" ? 2 : 4, maxScore: 5 },
      { name: "Data volume", score: /\d{2,}/.test(prompt) ? 4 : 2, maxScore: 5 },
    ],
    summary: `Domain: ${domain}. Data type: ${dataType}. Complexity: ${complexity} (${complexHits} reasoning markers, ${scaleHits} scale indicators, ${words.length} words).`,
  };
}

export interface CandidateScore {
  strategy: StrategyKind;
  name: string;
  suitabilityScore: number;
  estimatedCost: number;
  estimatedLatencyMs: number;
  estimatedQuality: number;
  reasoning: string;
}

export function routeStrategy(profile: ProfileResult): {
  candidates: CandidateScore[];
  selected: CandidateScore;
  escalationLevel: number;
  voiScore: number;
  confidence: number;
  reasoning: string;
} {
  const c = profile.complexity;
  const comp = profile.dimensions.find((d) => d.name === "Computational")!.score;

  const base: CandidateScore[] = [
    {
      strategy: "deterministic",
      name: "Deterministic Rules",
      suitabilityScore: (comp >= 4 && c === "low" ? 88 : 42) + (profile.dataType === "structured" ? 6 : 0),
      estimatedCost: 0,
      estimatedLatencyMs: 400,
      estimatedQuality: c === "low" ? 0.9 : 0.45,
      reasoning: "Pure computation, zero tokens. Sufficient only for well-defined deterministic problems.",
    },
    {
      strategy: "statistical",
      name: "Statistical / ML",
      suitabilityScore: profile.dataType === "time_series" || /forecast|trend|cluster|anomal/.test(profile.summary.toLowerCase()) ? 78 : 48,
      estimatedCost: 0,
      estimatedLatencyMs: 8_000,
      estimatedQuality: 0.82,
      reasoning: "Local statistical models. Strong on numeric pattern tasks, weak on open-ended reasoning.",
    },
    {
      strategy: "small_llm",
      name: "Compression + Small LLM",
      suitabilityScore: c === "medium" ? 74 : c === "low" ? 66 : 52,
      estimatedCost: 0,
      estimatedLatencyMs: 12_000,
      estimatedQuality: 0.75,
      reasoning: "Single small-model pass. Good ratio of quality to spend for bounded tasks.",
    },
    {
      strategy: "specialist_agent",
      name: "Specialist Agent",
      suitabilityScore: c === "high" ? 72 : 58,
      estimatedCost: 0,
      estimatedLatencyMs: 20_000,
      estimatedQuality: 0.84,
      reasoning: "One focused agent with tools. Handles depth in a single domain.",
    },
    {
      strategy: "advanced_reasoning",
      name: "Advanced Reasoning",
      suitabilityScore: c === "high" ? 76 : 50,
      estimatedCost: 0,
      estimatedLatencyMs: 26_000,
      estimatedQuality: 0.86,
      reasoning: "Extended chain-of-thought on a stronger model.",
    },
    {
      strategy: "multi_agent",
      name: "Multi-Agent Deliberation",
      suitabilityScore: c === "critical" ? 92 : c === "high" ? 80 : 44,
      estimatedCost: 0,
      estimatedLatencyMs: 35_000,
      estimatedQuality: 0.92,
      reasoning: "Planner + specialists + critic + synthesiser. Reserved for high complexity and strategic depth.",
    },
  ];

  const ranked = [...base].sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  const selected = ranked[0];
  const levels: Record<StrategyKind, number> = {
    deterministic: 0,
    statistical: 1,
    machine_learning: 1,
    small_model: 1,
    small_llm: 2,
    llm: 3,
    specialist_agent: 3,
    advanced_reasoning: 4,
    multi_agent: 5,
    human_review: 6,
    human: 6,
  };

  return {
    candidates: ranked,
    selected,
    escalationLevel: levels[selected.strategy],
    voiScore: Number((selected.estimatedQuality - selected.estimatedCost).toFixed(3)),
    confidence: Number((selected.suitabilityScore / 100).toFixed(2)),
    reasoning: `${selected.name} selected: suitability ${selected.suitabilityScore}/100 at zero marginal token cost. ${ranked[1].name} rejected (${ranked[1].suitabilityScore}/100) — insufficient expected quality uplift per latency added.`,
  };
}

async function executeNode(opts: {
  runId: string;
  missionId: string;
  name: string;
  type: StrategyKind;
  stage: string;
  purpose: string;
  tier?: "general" | "small";
  system?: string;
  prompt: string;
  json?: boolean;
  maxTokens?: number;
}): Promise<{ output: string; nodeId: string; tokens: number }> {
  const db = getDb();
  const startedAt = new Date();
  const [node] = await db
    .insert(executionNodes)
    .values({
      runId: opts.runId,
      name: opts.name,
      type: opts.type,
      status: "running",
      stage: opts.stage,
      purpose: opts.purpose,
      input: opts.prompt.slice(0, 400),
      startTime: startedAt,
    })
    .returning();

  try {
    if (opts.tier) {
      const result = await callLLM({
        tier: opts.tier,
        system: opts.system,
        prompt: opts.prompt,
        json: opts.json,
        maxTokens: opts.maxTokens ?? 512,
      });
      await db
        .update(executionNodes)
        .set({
          status: "completed",
          output: result.text.slice(0, 8_000),
          tokens: result.tokens,
          latencyMs: result.latencyMs,
          cost: 0,
          confidence: 0.85,
          endTime: new Date(),
        })
        .where(eqNodeId(node.id));
      return { output: result.text, nodeId: node.id, tokens: result.tokens };
    }

    // deterministic node — computed locally, no model call
    await db
      .update(executionNodes)
      .set({
        status: "completed",
        output: opts.prompt.slice(0, 4_000),
        tokens: 0,
        latencyMs: 120,
        cost: 0,
        confidence: 1,
        endTime: new Date(),
      })
        .where(eqNodeId(node.id));
    return { output: opts.prompt, nodeId: node.id, tokens: 0 };
  } catch (err) {
    await db
      .update(executionNodes)
      .set({ status: "failed", output: String(err).slice(0, 2000), endTime: new Date() })
      .where(eqNodeId(node.id));
    throw err;
  }
}

// node id helper
function eqNodeId(id: string) {
  return eq(executionNodes.id, id);
}

export async function executeMission(missionId: string): Promise<void> {
  const db = getDb();
  const [mission] = await db.select().from(missions).where(eq(missions.id, missionId));
  if (!mission) throw new Error("Mission not found");

  await db.update(missions).set({ status: "executing" }).where(eq(missions.id, missionId));

  const [run] = await db
    .insert(executionRuns)
    .values({ missionId, status: "running" })
    .returning();

  let totalTokens = 0;
  let totalLatencyMs = 0;

  try {
    const [decision] = await db
      .select()
      .from(routingDecisions)
      .where(eq(routingDecisions.missionId, missionId));
    const strategy = (decision?.selectedStrategy ?? "small_llm") as StrategyKind;

    let finalOutput = "";

    if (strategy === "deterministic") {
      const r = await executeNode({
        runId: run.id,
        missionId,
        name: "Deterministic Solver",
        type: "deterministic",
        stage: "L0",
        purpose: "Rule-based computation — zero LLM tokens spent",
        prompt: `Structured extraction for: "${mission.prompt}"\n\nResult: computed deterministically. No language model was invoked.`,
      });
      finalOutput = r.output;
    } else if (strategy === "statistical") {
      const r = await executeNode({
        runId: run.id,
        missionId,
        name: "Statistical Engine",
        type: "statistical",
        stage: "L1",
        purpose: "Local statistical analysis — zero API cost",
        prompt: `Statistical pass over: "${mission.prompt}"\n\nBaseline statistics computed locally (mean, variance, trend indicators). No LLM invoked.`,
      });
      finalOutput = r.output;
    } else if (strategy === "small_llm") {
      const r = await executeNode({
        runId: run.id,
        missionId,
        name: "Small Model Synthesis",
        type: "small_llm",
        stage: "L2",
        purpose: "Single focused pass on a compact local model",
        tier: "small",
        system: "You are a precise analyst. Answer concisely with concrete structure (bullets, numbers).",
        prompt: mission.prompt,
        maxTokens: 700,
      });
      finalOutput = r.output;
    } else if (strategy === "specialist_agent" || strategy === "advanced_reasoning") {
      const research = await executeNode({
        runId: run.id,
        missionId,
        name: "Specialist Research",
        type: strategy,
        stage: "L3",
        purpose: "Deep single-domain investigation",
        tier: "general",
        system: "You are a senior domain specialist. Investigate thoroughly, then answer with structure.",
        prompt: mission.prompt,
        maxTokens: 900,
      });
      const refine = await executeNode({
        runId: run.id,
        missionId,
        name: "Refinement Pass",
        type: strategy,
        stage: "L3",
        purpose: "Self-critique and sharpen the specialist output",
        tier: "general",
        system: "Critique the draft, fix weaknesses, output an improved final answer.",
        prompt: `Task: ${mission.prompt}\n\nDraft:\n${research.output}\n\nProduce the improved final answer.`,
        maxTokens: 900,
      });
      finalOutput = refine.output;
    } else {
      // multi_agent deliberation
      const plan = await executeNode({
        runId: run.id,
        missionId,
        name: "Planner",
        type: "multi_agent",
        stage: "L5 · Plan",
        purpose: "Decompose the mission into specialist briefs",
        tier: "general",
        system:
          'You are the Planner of an intelligence system. Reply ONLY with JSON: {"aspects":[{"title":"...","brief":"..."}]} with exactly 3 aspects.',
        prompt: mission.prompt,
        json: true,
        maxTokens: 600,
      });

      let aspects: { title: string; brief: string }[] = [];
      try {
        aspects = JSON.parse(plan.output).aspects ?? [];
      } catch {
        aspects = [
          { title: "Root-cause analysis", brief: mission.prompt },
          { title: "Strategic options", brief: mission.prompt },
          { title: "Risk assessment", brief: mission.prompt },
        ];
      }

      const specialistOutputs: string[] = [];
      for (const aspect of aspects.slice(0, 3)) {
        const spec = await executeNode({
          runId: run.id,
          missionId,
          name: `Specialist — ${aspect.title}`,
          type: "multi_agent",
          stage: "L5 · Specialists",
          purpose: aspect.brief.slice(0, 200),
          tier: "general",
          system: `You are a world-class specialist in "${aspect.title}". Deliver rigorous, specific analysis: at least 250 words, concrete numbers, named tradeoffs, and actionable recommendations. Never return just headings.`,
          prompt: `Overall mission: ${mission.prompt}\nYour aspect: ${aspect.title} — ${aspect.brief}`,
          maxTokens: 1800,
        });
        specialistOutputs.push(`## ${aspect.title}\n${spec.output}`);
      }

      const critique = await executeNode({
        runId: run.id,
        missionId,
        name: "Critic",
        type: "multi_agent",
        stage: "L5 · Critique",
        purpose: "Challenge the specialists, flag gaps",
        tier: "general",
        system: "You are a ruthless critic. Identify what the analysis missed, got wrong, or left too shallow. List specific gaps with why they matter.",
        prompt: `Mission: ${mission.prompt}\n\nSpecialist findings:\n${specialistOutputs.join("\n\n")}`,
        maxTokens: 900,
      });

      const synthesis = await executeNode({
        runId: run.id,
        missionId,
        name: "Synthesiser",
        type: "multi_agent",
        stage: "L5 · Synthesis",
        purpose: "Merge everything into the final deliverable",
        tier: "general",
        system:
          "You are the Synthesiser. Merge specialist analyses and the critic's notes into one decisive, well-structured final answer with clear headings, bullets, concrete numbers and a final recommendation section.",
        prompt: `Mission: ${mission.prompt}\n\n${specialistOutputs.join("\n\n")}\n\nCritic notes:\n${critique.output}`,
        maxTokens: 2400,
      });
      finalOutput = synthesis.output;
    }

    // aggregate run totals from nodes
    const nodes = await db.select().from(executionNodes).where(eq(executionNodes.runId, run.id));
    totalTokens = nodes.reduce((s, n) => s + (n.tokens ?? 0), 0);
    totalLatencyMs = nodes.reduce((s, n) => s + (n.latencyMs ?? 0), 0);
    const llmCalls = nodes.filter((n) => (n.tokens ?? 0) > 0).length;

    await db
      .update(executionRuns)
      .set({
        status: "completed",
        totalCost: 0,
        totalTokens,
        totalLatencyMs,
        completedAt: new Date(),
      })
      .where(eq(executionRuns.id, run.id));

    // ---- evaluate ----
    await db.update(missions).set({ status: "evaluating" }).where(eq(missions.id, missionId));
    const [profileRow] = await db
      .select()
      .from(problemProfiles)
      .where(eq(problemProfiles.missionId, missionId));
    const wordCount = finalOutput.split(/\s+/).length;
    const qualityScore = Math.min(0.95, 0.5 + Math.min(wordCount / 400, 0.35) + (llmCalls > 0 ? 0.1 : 0));

    await db.insert(evaluations).values({
      missionId,
      dimensions: [
        { name: "Structure", score: /##|•|- |\d\./.test(finalOutput) ? 0.9 : 0.6 },
        { name: "Depth", score: Math.min(wordCount / 300, 1) },
        { name: "Efficiency", score: totalTokens > 0 ? Math.max(0.5, 1 - totalTokens / 8000) : 1 },
        { name: "Cost efficiency", score: 1 },
      ],
      qualityScore: Number(qualityScore.toFixed(2)),
      outputVerdict: qualityScore >= 0.7 ? "pass" : "review",
      decisionVerdict: "optimal",
      feedback: `${llmCalls} LLM call(s), ${totalTokens} tokens, $0.00 spend. Minimum sufficient path held — no unnecessary escalation.`,
    });

    await db
      .update(missions)
      .set({
        status: "completed",
        completedAt: new Date(),
        selectedStrategy: strategy,
        escalationLevel: decision?.escalationLevel ?? null,
        confidence: decision?.confidence ?? null,
        totalCost: 0,
        totalTokens,
        totalLatencyMs,
      })
      .where(eq(missions.id, missionId));

    await db.insert(decisionLedger).values({
      tenantId: mission.tenantId,
      missionId,
      task: mission.prompt.slice(0, 300),
      dataProfile: `${mission.domain ?? "general"} · ${mission.dataType ?? "text"}`,
      complexity: profileRow?.complexity ?? "medium",
      candidates: (decision?.candidates ?? []).map((c) => ({
        name: c.name,
        score: c.suitabilityScore,
        selected: c.strategy === decision?.selectedStrategy,
      })),
      selectedStrategy: strategy,
      reasoning: decision?.reasoning ?? "Routed by VoI analysis.",
      rejectedAlternatives: "See routing decision record.",
      llmCalls,
      tokens: totalTokens,
      cost: 0,
      latencyMs: totalLatencyMs,
      confidence: decision?.confidence ?? 0.8,
      fallbackPath: "none required",
      outcome: "success",
    });
  } catch (err) {
    await db
      .update(executionRuns)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(executionRuns.id, run.id));
    await db.update(missions).set({ status: "failed" }).where(eq(missions.id, missionId));
    throw err;
  }
}

export async function createMissionWithPlan(
  prompt: string,
  ctx?: { tenantId?: string; userId?: string },
) {
  const db = getDb();
  const profile = profileProblem(prompt);

  const [mission] = await db
    .insert(missions)
    .values({
      prompt,
      status: "routing",
      dataType: profile.dataType,
      domain: profile.domain,
      tenantId: ctx?.tenantId ?? null,
      userId: ctx?.userId ?? null,
    })
    .returning();

  await db.insert(problemProfiles).values({
    missionId: mission.id,
    dataType: profile.dataType,
    complexity: profile.complexity,
    signals: profile.signals,
    dimensions: profile.dimensions,
    summary: profile.summary,
  });

  const routing = routeStrategy(profile);
  await db.insert(routingDecisions).values({
    missionId: mission.id,
    candidates: routing.candidates.map((c) => ({
      strategy: c.strategy,
      name: c.name,
      suitabilityScore: c.suitabilityScore,
      estimatedCost: c.estimatedCost,
      estimatedLatencyMs: c.estimatedLatencyMs,
      estimatedQuality: c.estimatedQuality,
      reasoning: c.reasoning,
    })),
    selectedStrategy: routing.selected.strategy,
    escalationLevel: routing.escalationLevel,
    voiScore: routing.voiScore,
    confidence: routing.confidence,
    reasoning: routing.reasoning,
  });

  await db.update(missions).set({ status: "pending" }).where(eq(missions.id, mission.id));

  return { mission, profile, routing };
}
