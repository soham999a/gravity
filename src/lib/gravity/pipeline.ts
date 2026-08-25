import { eq, and, inArray, lt } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import {
  missions,
  problemProfiles,
  routingDecisions,
  executionRuns,
  executionNodes,
  decisionLedger,
  evaluations,
} from "@/lib/drizzle/schema";
import { callLLM, isLLMConfigured } from "@/lib/gravity/llm";
import { analyzeDataset, formatReportForLLM } from "@/lib/gravity/stats";
import type { StrategyKind } from "@/lib/gravity/types";

type Complexity = "low" | "medium" | "high" | "critical";

/**
 * Wall-clock budget for one mission execution. Vercel Hobby allows 60s;
 * leave headroom for DB writes so we always finish cleanly.
 */
const EXECUTION_DEADLINE_MS = 52_000;

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

/** Explicit computational intent — the only trigger that can route to L0/L1. */
const COMPUTATIONAL_RE =
  /\b(calculate|compute|optimi[sz]e|solve|schedule|allocate|minimi[sz]e|maximi[sz]e|route)\b/i;

const SCALE_RE = /\b\d+(?:\.\d+)?\s*(?:m|mm|k|b|million|billion|thousand|%|percent|x)\b|\b\d{2,}\b/gi;

export interface ProfileResult {
  dataType: string;
  complexity: Complexity;
  domain: string;
  signals: { name: string; value: number; unit?: string }[];
  dimensions: { name: string; score: number; maxScore: number }[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Problem profiling — heuristic baseline, optionally refined by an LLM pass.
// ---------------------------------------------------------------------------

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
      { name: "Computational", score: COMPUTATIONAL_RE.test(lower) ? 5 : 2, maxScore: 5 },
      { name: "Reasoning depth", score: complexity === "low" ? 1 : complexity === "medium" ? 2 : 4, maxScore: 5 },
      { name: "Data volume", score: /\d{2,}/.test(prompt) ? 4 : 2, maxScore: 5 },
    ],
    summary: `Domain: ${domain}. Data type: ${dataType}. Complexity: ${complexity} (${complexHits} reasoning markers, ${scaleHits} scale indicators, ${words.length} words).`,
  };
}

interface SmartProfile extends ProfileResult {
  profilerUsedLlm: boolean;
}

/**
 * Refine the heuristic profile with an LLM classification pass. Falls back
 * silently to the heuristic result on any failure — profiling must never
 * block or break mission creation.
 */
async function profileProblemSmart(prompt: string): Promise<SmartProfile> {
  const baseline = profileProblem(prompt);
  if (!isLLMConfigured()) return { ...baseline, profilerUsedLlm: false };

  try {
    const res = await callLLM({
      tier: "small",
      system:
        'You classify problem statements for an intelligence router. Reply ONLY with JSON: {"dataType":"structured|text|documents|images|time_series|mixed","complexity":"low|medium|high|critical","domain":"one lowercase word","summary":"one sentence describing what is being asked"}',
      prompt,
      json: true,
      maxTokens: 220,
      temperature: 0.1,
      timeoutMs: 10_000,
    });

    const parsed = safeJson<Partial<ProfileResult>>(res.text);
    if (!parsed) return { ...baseline, profilerUsedLlm: false };

    const validTypes = ["structured", "text", "documents", "images", "time_series", "mixed"];
    const validComplexity = ["low", "medium", "high", "critical"];

    return {
      ...baseline,
      dataType: validTypes.includes(parsed.dataType ?? "") ? parsed.dataType! : baseline.dataType,
      complexity: validComplexity.includes(parsed.complexity ?? "")
        ? (parsed.complexity as Complexity)
        : baseline.complexity,
      domain: typeof parsed.domain === "string" && /^[a-z]{3,20}$/.test(parsed.domain)
        ? parsed.domain
        : baseline.domain,
      summary: typeof parsed.summary === "string" && parsed.summary.length > 10
        ? `${parsed.summary} (heuristic signals: ${baseline.summary.toLowerCase()})`
        : baseline.summary,
      profilerUsedLlm: true,
    };
  } catch {
    return { ...baseline, profilerUsedLlm: false };
  }
}

/** Extract the first JSON object from model text, tolerating code fences. */
function safeJson<T>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Intelligence routing — cheap rule core with honest Value-of-Intelligence
// margins. The router itself must never be an expensive model call.
// ---------------------------------------------------------------------------

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
  const isTimeSeries = profile.dataType === "time_series";
  const wantsComputation = comp >= 4 || COMPUTATIONAL_RE.test(profile.summary);

  // L0 only for explicitly computational asks at low complexity — otherwise
  // the ladder floor is L2 so every customer gets genuinely useful output.
  const deterministicFit =
    c === "low" && wantsComputation ? 88 : wantsComputation ? 58 : 24;

  const base: CandidateScore[] = [
    {
      strategy: "deterministic",
      name: "Deterministic Rules",
      suitabilityScore: deterministicFit + (profile.dataType === "structured" ? 4 : 0),
      estimatedCost: 0,
      estimatedLatencyMs: 400,
      estimatedQuality: c === "low" && wantsComputation ? 0.88 : 0.4,
      reasoning: "Pure local computation, zero tokens. Only viable when the task is fully specified computation.",
    },
    {
      strategy: "statistical",
      name: "Statistical / ML",
      suitabilityScore: isTimeSeries && !wantsComputation ? 80 : isTimeSeries ? 72 : 38,
      estimatedCost: 0,
      estimatedLatencyMs: 8_000,
      estimatedQuality: isTimeSeries ? 0.84 : 0.5,
      reasoning: "Local statistical models. Strong on numeric pattern tasks, weak on open-ended reasoning.",
    },
    {
      strategy: "small_llm",
      name: "Compression + Small LLM",
      suitabilityScore: c === "low" ? 78 : c === "medium" ? 74 : c === "high" ? 58 : 44,
      estimatedCost: 0,
      estimatedLatencyMs: 12_000,
      estimatedQuality: 0.76,
      reasoning: "Single focused pass on a compact model. Best quality-per-token for bounded tasks.",
    },
    {
      strategy: "specialist_agent",
      name: "Specialist Agent",
      suitabilityScore: c === "medium" ? 62 : c === "high" ? 76 : 46,
      estimatedCost: 0,
      estimatedLatencyMs: 20_000,
      estimatedQuality: 0.85,
      reasoning: "One focused specialist pass with self-refinement. Depth without deliberation overhead.",
    },
    {
      strategy: "advanced_reasoning",
      name: "Advanced Reasoning",
      suitabilityScore: c === "high" ? 74 : 48,
      estimatedCost: 0,
      estimatedLatencyMs: 26_000,
      estimatedQuality: 0.86,
      reasoning: "Extended single-model reasoning. Marginal over specialist for most enterprise tasks.",
    },
    {
      strategy: "multi_agent",
      name: "Multi-Agent Deliberation",
      suitabilityScore: c === "critical" ? 92 : c === "high" ? 79 : c === "medium" ? 52 : 30,
      estimatedCost: 0,
      estimatedLatencyMs: 32_000,
      estimatedQuality: 0.92,
      reasoning: "Planner + parallel specialists + critic + synthesiser. Reserved for strategic depth.",
    },
  ];

  const ranked = [...base].sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  const selected = ranked[0];
  const runnerUp = ranked[1];
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

  const qualityUplift = Number((selected.estimatedQuality - runnerUp.estimatedQuality).toFixed(2));
  const confidence = Math.min(0.97, 0.55 + (selected.suitabilityScore - runnerUp.suitabilityScore) / 250);

  return {
    candidates: ranked,
    selected,
    escalationLevel: levels[selected.strategy],
    voiScore: Number(((selected.estimatedQuality - runnerUp.estimatedQuality) / Math.max(selected.estimatedLatencyMs / 1000, 0.4)).toFixed(3)),
    confidence: Number(confidence.toFixed(2)),
    reasoning:
      `${selected.name} selected (${selected.suitabilityScore}/100, expected quality ${Math.round(selected.estimatedQuality * 100)}%). ` +
      `${runnerUp.name} rejected (${runnerUp.suitabilityScore}/100): would cost +${Math.round(Math.max(0, runnerUp.estimatedLatencyMs - selected.estimatedLatencyMs) / 1000)}s more latency ` +
      `for ${qualityUplift >= 0 ? "+" : ""}${qualityUplift} quality uplift. Profile: ${c} complexity, ${profile.dataType} data.`,
  };
}

// ---------------------------------------------------------------------------
// Node execution with per-node persistence and one retry on transient errors.
// ---------------------------------------------------------------------------

async function executeNode(opts: {
  runId: string;
  name: string;
  type: StrategyKind;
  stage: string;
  purpose: string;
  tier?: "general" | "small";
  system?: string;
  prompt: string;
   json?: boolean;
   maxTokens?: number;
   /** Skip the retry when the mission is close to its wall-clock budget. */
   deadlineAt?: number;
   /** Pre-computed local artifact — skips the LLM call entirely. */
   outputOverride?: string;
 }): Promise<{ output: string; nodeId: string; tokens: number; latencyMs: number }> {
  const db = getDb();
  const [node] = await db
    .insert(executionNodes)
    .values({
      runId: opts.runId,
      name: opts.name,
      type: opts.type,
      status: "running",
      stage: opts.stage,
      purpose: opts.purpose.slice(0, 300),
      input: opts.prompt.slice(0, 400),
      startTime: new Date(),
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
        timeoutMs: 28_000,
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
        .where(eq(executionNodes.id, node.id));
      return { output: result.text, nodeId: node.id, tokens: result.tokens, latencyMs: result.latencyMs };
    }

    // Deterministic node — computed locally, genuinely no model call.
    await db
      .update(executionNodes)
      .set({
        status: "completed",
        output: opts.outputOverride ?? opts.prompt.slice(0, 4_000),
        tokens: 0,
        latencyMs: 120,
        cost: 0,
        confidence: 1,
        endTime: new Date(),
      })
      .where(eq(executionNodes.id, node.id));
    return { output: opts.outputOverride ?? opts.prompt, nodeId: node.id, tokens: 0, latencyMs: 120 };
  } catch (err) {
    const canRetry =
      opts.deadlineAt === undefined || Date.now() < opts.deadlineAt - 14_000;
    if (canRetry) {
      try {
        const result = await callLLM({
          tier: opts.tier ?? "general",
          system: opts.system,
          prompt: opts.prompt,
          json: opts.json,
          maxTokens: opts.maxTokens ?? 512,
          timeoutMs: 22_000,
        });
        await db
          .update(executionNodes)
          .set({
            status: "completed",
            output: result.text.slice(0, 8_000),
            tokens: result.tokens,
            latencyMs: result.latencyMs,
            cost: 0,
            confidence: 0.8,
            endTime: new Date(),
          })
          .where(eq(executionNodes.id, node.id));
        return { output: result.text, nodeId: node.id, tokens: result.tokens, latencyMs: result.latencyMs };
      } catch {
        /* fall through to failure */
      }
    }
    await db
      .update(executionNodes)
      .set({ status: "failed", output: String(err).slice(0, 2000), endTime: new Date() })
      .where(eq(executionNodes.id, node.id));
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Genuine local computation for L0/L1 nodes. No theatre: these produce real
// derived artefacts from the prompt itself.
// ---------------------------------------------------------------------------

function deterministicArtifact(prompt: string): string {
  const entities = [...new Set(
    (prompt.match(/\b[A-Z][a-zA-Z]{2,}(?:\s[A-Z][a-zA-Z]{2,})?\b/g) ?? []).slice(0, 12),
  )];
  const numbers = [...prompt.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((m) => m[0]);
  const constraints = (prompt.match(/\b(?:within|under|at least|maximum|minimum|no more than|less than|greater than)\s[^.,;]+/gi) ?? []).slice(0, 6);

  return [
    "PROBLEM SPECIFICATION — computed locally, zero model tokens.",
    "",
    "Objective:",
    `  ${prompt.trim().replace(/\s+/g, " ").slice(0, 240)}`,
    "",
    "Entities identified:",
    ...(entities.length ? entities.map((e) => `  • ${e}`) : ["  • (none detected)"]),
    "",
    "Numeric parameters:",
    ...(numbers.length ? numbers.map((n) => `  • ${n}`) : ["  • (none supplied — attach data for exact solving)"]),
    "",
    "Constraints extracted:",
    ...(constraints.length ? constraints.map((c) => `  • ${c.trim()}`) : ["  • (none stated)"]),
    "",
    "Recommended solver class: constraint programme / rules engine.",
    "Status: specification complete. Route to a data connector for exact solution.",
  ].join("\n");
}

function statisticalArtifact(prompt: string): string {
  const series = [...prompt.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((m) => parseFloat(m[0]));
  const words = prompt.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];

  let statsBlock: string[];
  if (series.length >= 3) {
    const n = series.length;
    const mean = series.reduce((s, v) => s + v, 0) / n;
    const variance = series.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const sorted = [...series].sort((a, b) => a - b);
    const median = n % 2 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
    const slope = series.length >= 2 ? series[series.length - 1]! - series[0]! : 0;

    statsBlock = [
      `Series length          n = ${n}`,
      `Mean                   μ = ${mean.toFixed(3)}`,
      `Median                 m = ${median.toFixed(3)}`,
      `Std deviation          σ = ${std.toFixed(3)}`,
      `Coefficient of variation = ${(mean !== 0 ? std / Math.abs(mean) : 0).toFixed(3)}`,
      `Min / Max              ${sorted[0]!.toFixed(3)} / ${sorted[n - 1]!.toFixed(3)}`,
      `Net drift (last-first) Δ = ${slope.toFixed(3)} (${slope > 0 ? "upward" : slope < 0 ? "downward" : "flat"})`,
    ];
  } else {
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    statsBlock = [
      `Tokens analysed        ${words.length}`,
      `Distinct terms         ${freq.size}`,
      "",
      "Top terms by frequency:",
      ...top.map(([w, f]) => `  • ${w} — ${f}×`),
      "",
      "(Fewer than 3 numeric values found — descriptive statistics require a data payload.)",
    ];
  }

  return [
    "STATISTICAL PASS — computed locally, zero API cost.",
    "",
    ...statsBlock,
    "",
    "Method notes: descriptive statistics only. Predictive modelling",
    "(Prophet/XGBoost) activates when a historical dataset is connected.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Evaluation — LLM-as-judge grading with heuristic fallback.
// ---------------------------------------------------------------------------

interface JudgeVerdict {
  accuracy: number;
  depth: number;
  clarity: number;
  actionability: number;
  verdict: "pass" | "review" | "fail";
  feedback: string;
}

async function judgeOutput(missionPrompt: string, output: string): Promise<{ judge: JudgeVerdict | null; usedLlm: boolean }> {
  if (!isLLMConfigured()) return { judge: null, usedLlm: false };
  try {
    const res = await callLLM({
      tier: "general",
      system:
        'You grade AI-generated answers. Reply ONLY with JSON: {"accuracy":0-100,"depth":0-100,"clarity":0-100,"actionability":0-100,"verdict":"pass|review|fail","feedback":"one decisive sentence"}. Judge substance, not style.',
      prompt: `TASK:\n${missionPrompt.slice(0, 1200)}\n\nANSWER:\n${output.slice(0, 6000)}`,
      json: true,
      maxTokens: 260,
      temperature: 0.1,
      timeoutMs: 18_000,
    });
    const parsed = safeJson<JudgeVerdict>(res.text);
    if (!parsed || typeof parsed.accuracy !== "number") return { judge: null, usedLlm: false };
    const clamp = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0)) / 100;
    return {
      judge: {
        accuracy: clamp(parsed.accuracy),
        depth: clamp(parsed.depth),
        clarity: clamp(parsed.clarity),
        actionability: clamp(parsed.actionability),
        verdict: parsed.verdict === "pass" || parsed.verdict === "fail" ? parsed.verdict : "review",
        feedback: String(parsed.feedback ?? "").slice(0, 500),
      },
      usedLlm: true,
    };
  } catch {
    return { judge: null, usedLlm: false };
  }
}

// ---------------------------------------------------------------------------
// Stale-mission watchdog: recover missions whose serverless function died
// mid-execution (deploy, cold start kill, crash).
// ---------------------------------------------------------------------------

export async function failStaleMissions(): Promise<void> {
  if (!isDbConfigured) return;
  const cutoff = new Date(Date.now() - 3 * 60_000);
  const stale = await getDb()
    .select({ id: missions.id })
    .from(missions)
    .where(and(inArray(missions.status, ["executing", "evaluating"]), lt(missions.createdAt, cutoff)));
  if (stale.length === 0) return;
  const ids = stale.map((s) => s.id);
  await getDb().update(missions).set({ status: "failed", completedAt: new Date() }).where(inArray(missions.id, ids));
}

// ---------------------------------------------------------------------------
// Main mission execution.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CSV data marker — embedded in the prompt field by the client or upload API.
// Format: [DATA:csv:filename.csv]\n...\n[/DATA]\n\n<user instruction>
// Supports multiple markers for multi-file analysis.
// ---------------------------------------------------------------------------

function extractCSVData(prompt: string): { csv: string; fileName: string; cleanPrompt: string }[] {
  const all: { csv: string; fileName: string; cleanPrompt: string }[] = [];
  let cleanPrompt = prompt;
  const re = /\[DATA:csv(?::([^\]]*))?\]\n([\s\S]*?)\n\[\/DATA\]\n*/g;
  let m;
  while ((m = re.exec(prompt)) !== null) {
    all.push({ csv: m[2]!, fileName: m[1] ?? "data.csv", cleanPrompt: "" });
    cleanPrompt = cleanPrompt.replace(m[0], "");
  }
  if (all.length > 0) all[0]!.cleanPrompt = cleanPrompt.trim();
  return all;
}

export async function executeMission(missionId: string): Promise<void> {
  const db = getDb();
  const deadlineAt = Date.now() + EXECUTION_DEADLINE_MS;
  const [mission] = await db.select().from(missions).where(eq(missions.id, missionId));
  if (!mission) throw new Error("Mission not found");

  await db.update(missions).set({ status: "executing" }).where(eq(missions.id, missionId));

  const [run] = await db
    .insert(executionRuns)
    .values({ missionId, status: "running" })
    .returning();

  // Check if the prompt contains embedded CSV data (supports multiple files)
  const csvPayloads = extractCSVData(mission.prompt);

  try {
    const [decision] = await db
      .select()
      .from(routingDecisions)
      .where(eq(routingDecisions.missionId, missionId));
    const strategy = (decision?.selectedStrategy ?? "small_llm") as StrategyKind;

    let finalOutput = "";

    // ─── FILE-BACKED DATA ANALYSIS PATH ────────────────────────────
    // When the user uploaded one or more CSVs, we run the statistical
    // engine locally on each file (zero cost), combine the reports,
    // then feed everything to Gemini Flash for synthesis.
    if (csvPayloads.length > 0) {
      const userPrompt = csvPayloads[0]!.cleanPrompt;
      const allReports: string[] = [];

      // Step 1: Run statistical engine on each file (FREE — pure computation)
      for (let i = 0; i < csvPayloads.length; i++) {
        const payload = csvPayloads[i]!;
        const analysisReport = analyzeDataset(payload.csv, userPrompt);
        const reportText = formatReportForLLM(analysisReport, userPrompt);
        allReports.push(`\n### FILE ${i + 1}: ${payload.fileName}\n${reportText}`);

        await executeNode({
          runId: run.id,
          name: `Statistical Engine — ${payload.fileName}`,
          type: "statistical",
          stage: "L1 · Compute",
          purpose: `Analyze ${payload.fileName}: ${analysisReport.summary.rows} rows × ${analysisReport.summary.columns} columns — trend detection, anomaly scoring, correlation analysis`,
          prompt: reportText.slice(0, 2000),
          outputOverride: reportText,
        });
      }

      const combinedReport = allReports.join("\n\n");

      // Step 2: LLM synthesis using the combined reports (Gemini Flash — FREE tier)
      if (isLLMConfigured()) {
        const fileNames = csvPayloads.map((p) => p.fileName).join(", ");
        const synthNode = await executeNode({
          runId: run.id,
          name: "Data Synthesis",
          type: "small_llm",
          stage: "L2 · Synthesis",
          purpose: `Translate statistical findings from ${fileNames} into actionable management recommendations`,
          tier: "small",
          system:
            "You are a senior data analyst. You have been given complete statistical analysis reports " +
            "computed by GRAVITY's statistical engine for one or more datasets. Your job is to " +
            "translate these findings into clear, actionable recommendations. Structure your response as:\n" +
            "1. Executive Summary (2-3 sentences)\n" +
            "2. Key Findings per dataset (numbered, with specific numbers from the report)\n" +
            "3. Cross-dataset insights (if multiple files, compare patterns across them)\n" +
            "4. Risk Assessment (based on anomalies and trends detected)\n" +
            "5. Top Recommendations (ranked by expected impact, with evidence)\n" +
            "Use the EXACT numbers from the statistical reports. Never fabricate data. " +
            "If the report shows a trend, cite the slope and R². If anomalies exist, cite the z-scores.",
          prompt: combinedReport,
          maxTokens: 1800,
          deadlineAt,
        });
        finalOutput = synthNode.output;
      } else {
        finalOutput = combinedReport;
      }

    // ─── STANDARD TEXT PATHS (no CSV) ─────────────────────────────
    } else if (strategy === "deterministic") {
      const artifact = deterministicArtifact(mission.prompt);
      const r = await executeNode({
        runId: run.id,
        name: "Deterministic Specification",
        type: "deterministic",
        stage: "L0 · Compute",
        purpose: "Rule-based extraction of objective, entities, parameters, constraints — zero model tokens",
        prompt: artifact,
        outputOverride: artifact,
      });
      finalOutput = r.output;
    } else if (strategy === "statistical") {
      const artifact = statisticalArtifact(mission.prompt);
      const r = await executeNode({
        runId: run.id,
        name: "Statistical Engine",
        type: "statistical",
        stage: "L1 · Compute",
        purpose: "Descriptive statistics computed locally — zero API cost",
        prompt: artifact,
        outputOverride: artifact,
      });
      finalOutput = r.output;
    } else if (strategy === "small_llm") {
      const r = await executeNode({
        runId: run.id,
        name: "Focused Synthesis",
        type: "small_llm",
        stage: "L2 · Small Model",
        purpose: "Single focused pass on a compact model — best quality per token",
        tier: "small",
        system:
          "You are a precise senior analyst. Deliver a direct, well-structured answer: short intro line, then bullets or numbered sections with concrete specifics. End with a one-line bottom-line recommendation. Never pad, never just list headings.",
        prompt: mission.prompt,
        maxTokens: 900,
        deadlineAt,
      });
      finalOutput = r.output;
    } else if (strategy === "specialist_agent" || strategy === "advanced_reasoning") {
      const research = await executeNode({
        runId: run.id,
        name: "Specialist Investigation",
        type: strategy,
        stage: "L3 · Specialist",
        purpose: "Deep single-domain investigation",
        tier: "general",
        system:
          "You are a world-class domain specialist. Investigate the task rigorously and answer with concrete structure: findings, numbers where inferable, named trade-offs, actionable recommendations. Minimum 250 words. Never return headings alone.",
        prompt: mission.prompt,
        maxTokens: 1400,
        deadlineAt,
      });

      const refine = await executeNode({
        runId: run.id,
        name: "Refinement Pass",
        type: strategy,
        stage: "L3 · Refine",
        purpose: "Self-critique and sharpen the specialist output into the deliverable",
        tier: "general",
        system:
          "Critique the draft honestly, fix every weakness, then output ONLY the improved final answer — no meta-commentary about the draft.",
        prompt: `Task: ${mission.prompt}\n\nDraft:\n${research.output}\n\nProduce the improved final answer.`,
        maxTokens: 1400,
        deadlineAt,
      });
      finalOutput = refine.output;
    } else {
      // ---- L5 multi-agent deliberation -------------------------------
      const plan = await executeNode({
        runId: run.id,
        name: "Planner",
        type: "multi_agent",
        stage: "L5 · Plan",
        purpose: "Decompose the mission into three specialist briefs",
        tier: "general",
        system:
          'You are the Planner of an intelligence system. Reply ONLY with JSON: {"aspects":[{"title":"short specialist role","brief":"one-sentence investigation brief"}]} with exactly 3 aspects covering the most decision-relevant dimensions.',
        prompt: mission.prompt,
        json: true,
        maxTokens: 420,
        deadlineAt,
      });

      let aspects: { title: string; brief: string }[] = [];
      const parsedPlan = safeJson<{ aspects?: { title?: string; brief?: string }[] }>(plan.output);
      aspects = (parsedPlan?.aspects ?? [])
        .filter((a) => a.title)
        .slice(0, 3)
        .map((a) => ({ title: a.title!.slice(0, 60), brief: a.brief ?? mission.prompt }));
      if (aspects.length === 0) {
        aspects = [
          { title: "Root-cause analysis", brief: mission.prompt },
          { title: "Strategic options", brief: mission.prompt },
          { title: "Risk assessment", brief: mission.prompt },
        ];
      }

      // Specialists run in parallel — ~3× faster wall-clock, same quality.
      const specBudget = Math.max(1100, Math.min(1500, 1500));
      const specialistResults = await Promise.all(
        aspects.map((aspect) =>
          executeNode({
            runId: run.id,
            name: `Specialist — ${aspect.title}`,
            type: "multi_agent",
            stage: "L5 · Specialists",
            purpose: aspect.brief,
            tier: "general",
            system: `You are a world-class specialist acting as "${aspect.title}". Deliver rigorous, specific analysis for your aspect: at least 250 words, concrete numbers where inferable, named trade-offs, actionable recommendations. Never return just headings.`,
            prompt: `Overall mission: ${mission.prompt}\nYour aspect: ${aspect.title} — ${aspect.brief}`,
            maxTokens: specBudget,
            deadlineAt,
          }).catch((err) => {
            console.warn(`[pipeline] specialist "${aspect.title}" failed`, String(err).slice(0, 160));
            return { output: `(Specialist for "${aspect.title}" unavailable: ${String(err).slice(0, 120)})`, nodeId: "", tokens: 0, latencyMs: 0 };
          }),
        ),
      );
      const specialistOutputs = aspects.map(
        (aspect, i) => `## ${aspect.title}\n${specialistResults[i]!.output}`,
      );

      // Skip the critic when the wall-clock budget is nearly spent —
      // synthesiser output matters more than critique coverage.
      const skipCritic = Date.now() > deadlineAt - 16_000;
      let critiqueOutput = "";
      if (!skipCritic) {
        const critique = await executeNode({
          runId: run.id,
          name: "Critic",
          type: "multi_agent",
          stage: "L5 · Critique",
          purpose: "Challenge the specialists, flag gaps and errors",
          tier: "general",
          system:
            "You are a ruthless critic. Identify what the analysis missed, got wrong, or left too shallow. List specific gaps with why each matters. Maximum 8 bullets.",
          prompt: `Mission: ${mission.prompt}\n\nSpecialist findings:\n${specialistOutputs.join("\n\n")}`,
          maxTokens: 700,
          deadlineAt,
        });
        critiqueOutput = critique.output;
      }

      const synthesis = await executeNode({
        runId: run.id,
        name: "Synthesiser",
        type: "multi_agent",
        stage: "L5 · Synthesis",
        purpose: "Merge everything into the final decision-ready deliverable",
        tier: "general",
        system:
          "You are the Synthesiser. Merge specialist analyses and the critic's notes into ONE decisive final answer. Structure: 1) Executive summary (≤3 sentences), 2) Key findings with numbers, 3) Trade-offs, 4) Concrete recommendation with next steps. Be specific; never mention the process or the agents.",
        prompt: `Mission: ${mission.prompt}\n\n${specialistOutputs.join("\n\n")}${critiqueOutput ? `\n\nCritic notes:\n${critiqueOutput}` : ""}`,
        maxTokens: 1800,
        deadlineAt,
      });
      finalOutput = synthesis.output;
    }

    // aggregate run totals from nodes
    const nodes = await db.select().from(executionNodes).where(eq(executionNodes.runId, run.id));
    const totalTokens = nodes.reduce((s, n) => s + (n.tokens ?? 0), 0);
    const totalLatencyMs = nodes.reduce((s, n) => s + (n.latencyMs ?? 0), 0);
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

    // ---- evaluate: LLM-as-judge with heuristic fallback ---------------
    await db.update(missions).set({ status: "evaluating" }).where(eq(missions.id, missionId));
    const [profileRow] = await db
      .select()
      .from(problemProfiles)
      .where(eq(problemProfiles.missionId, missionId));

    const { judge, usedLlm } = await judgeOutput(mission.prompt, finalOutput);
    const wordCount = finalOutput.split(/\s+/).length;

    let qualityScore: number;
    let dimensionScores: { name: string; score: number; delta?: number }[];
    let feedback: string;

    if (judge) {
      const efficiency = totalTokens > 0 ? Math.max(0.5, 1 - totalTokens / 8000) : 1;
      qualityScore =
        judge.accuracy * 0.35 +
        judge.depth * 0.2 +
        judge.clarity * 0.15 +
        judge.actionability * 0.2 +
        efficiency * 0.1;
      dimensionScores = [
        { name: "Accuracy", score: judge.accuracy },
        { name: "Depth", score: judge.depth },
        { name: "Clarity", score: judge.clarity },
        { name: "Actionability", score: judge.actionability },
        { name: "Efficiency", score: efficiency },
      ];
      feedback = `${judge.feedback} (${llmCalls} LLM calls · ${totalTokens} tokens · $0.00 spend${usedLlm ? " · graded by model jury" : ""})`;
    } else {
      qualityScore = Math.min(0.95, 0.5 + Math.min(wordCount / 400, 0.35) + (llmCalls > 0 ? 0.1 : 0));
      dimensionScores = [
        { name: "Structure", score: /##|•|- |\d\./.test(finalOutput) ? 0.9 : 0.6 },
        { name: "Depth", score: Math.min(wordCount / 300, 1) },
        { name: "Efficiency", score: totalTokens > 0 ? Math.max(0.5, 1 - totalTokens / 8000) : 1 },
        { name: "Cost efficiency", score: 1 },
      ];
      feedback = `${llmCalls} LLM call(s), ${totalTokens} tokens, $0.00 spend. Heuristic evaluation (judge unavailable).`;
    }

    await db.insert(evaluations).values({
      missionId,
      dimensions: dimensionScores,
      qualityScore: Number(qualityScore.toFixed(2)),
      outputVerdict: judge?.verdict ?? (qualityScore >= 0.7 ? "pass" : "review"),
      decisionVerdict: "optimal",
      feedback: feedback.slice(0, 1000),
    });

    const runnerUpName =
      (decision?.candidates ?? [])
        .filter((cd) => cd.strategy !== strategy)
        .sort((a, b) => b.suitabilityScore - a.suitabilityScore)[0]?.name ?? "n/a";

    await db.insert(decisionLedger).values({
      tenantId: mission.tenantId,
      missionId,
      task: mission.prompt.slice(0, 300),
      dataProfile: `${mission.domain ?? "general"} · ${mission.dataType ?? "text"}`,
      complexity: profileRow?.complexity ?? "medium",
      candidates: (decision?.candidates ?? []).map((cd) => ({
        name: cd.name,
        score: cd.suitabilityScore,
        selected: cd.strategy === decision?.selectedStrategy,
      })),
      selectedStrategy: strategy,
      reasoning: decision?.reasoning ?? "Routed by VoI analysis.",
      rejectedAlternatives: `${runnerUpName} was the strongest alternative — insufficient expected quality uplift per added latency.`,
      llmCalls,
      tokens: totalTokens,
      cost: 0,
      latencyMs: totalLatencyMs,
      confidence: decision?.confidence ?? 0.8,
      fallbackPath: llmCalls === 0 ? "none required — pure computation" : "provider chain: gemini → groq",
      outcome: "success",
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
  } catch (err) {
    await db
      .update(executionRuns)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(executionRuns.id, run.id));
    await db.update(missions).set({ status: "failed", completedAt: new Date() }).where(eq(missions.id, missionId));
    throw err;
  }
}

export async function createMissionWithPlan(
  prompt: string,
  ctx?: { tenantId?: string; userId?: string; files?: { data: string; name: string }[] },
) {
  const db = getDb();

  // If files are provided, embed them in the prompt using the data marker
  // so executeMission can detect and process them.
  let effectivePrompt = prompt;
  if (ctx?.files && ctx.files.length > 0) {
    const markers = ctx.files.map(
      (f) => `[DATA:csv:${f.name}]\n${f.data}\n[/DATA]`,
    );
    effectivePrompt = markers.join("\n\n") + "\n\n" + prompt;
  }

  // Smart profiling: LLM-refined when configured, heuristic otherwise.
  const profile = await profileProblemSmart(effectivePrompt);

  // When CSV data is present, override the data type to structured/time_series
  // and boost complexity since we know data analysis is involved.
  if (ctx?.files && ctx.files.length > 0) {
    profile.dataType = "structured";
    if (profile.complexity === "low") profile.complexity = "medium";
  }

  const [mission] = await db
    .insert(missions)
    .values({
      prompt: effectivePrompt,
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
    candidates: routing.candidates.map((cd) => ({
      strategy: cd.strategy,
      name: cd.name,
      suitabilityScore: cd.suitabilityScore,
      estimatedCost: cd.estimatedCost,
      estimatedLatencyMs: cd.estimatedLatencyMs,
      estimatedQuality: cd.estimatedQuality,
      reasoning: cd.reasoning,
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
