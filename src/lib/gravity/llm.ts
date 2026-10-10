const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const CODECRAFT_URL = "https://codecraftapi.com/v1/chat/completions";
const CLEANAPIS_URL = "https://cleanapis.com/v1/chat/completions";

/**
 * 429-aware throttle handling: when a provider returns RESOURCE_EXHAUSTED,
 * wait out the provider-suggested delay (up to 20s locally; Vercel's 60s
 * function cap makes longer waits pointless) and retry the SAME provider
 * before falling through the chain. Prevents cascade failures on token-heavy
 * missions (L5 deliberation) that burst past free-tier TPM caps.
 */
function throttleDelayMs(errText: string): number {
  const retryMatch = errText.match(/"retryDelay": "(\d+)s"/);
  if (retryMatch) return Math.min(20_000, Number(retryMatch[1]) * 1000 + 500);
  return 12_000;
}

function isThrottled(status: number, errText: string): boolean {
  return status === 429 || /RESOURCE_EXHAUSTED|rate limit/i.test(errText);
}

// ---------------------------------------------------------------------------
// Quota-dead circuit breaker.
//
// A 429 that says "quota" (free tier exhausted — e.g. Gemini's
// generate_content_free_tier_requests, or a 402/insufficient-balance) will
// NOT clear in seconds. The old code slept up to 20s on EVERY call before
// failing over, so one dead primary burned the whole Vercel 60s function
// window and missions died mid-run with nodes stuck `running` (local dev has
// no such guillotine, which is why localhost kept working). Trip a
// per-provider cooldown instead and fail over immediately. Plain per-minute
// rate limits (429 without quota wording) keep the throttle-and-retry path.
// State is per-instance; cold starts re-probe automatically.
// ---------------------------------------------------------------------------

const QUOTA_COOLDOWN_MS = 10 * 60_000;
const BILLING_COOLDOWN_MS = 60 * 60_000;

const deadUntil = new Map<string, number>();

function isQuotaDead(status: number, errText: string): boolean {
  return status === 429 && /quota|free_tier/i.test(errText);
}

function isBillingDead(status: number, errText: string): boolean {
  return status === 401 || status === 402 || status === 403 || /insufficient.*balance|invalid.*key|unauthorized/i.test(errText);
}

/** Trip the breaker and report whether the caller should fail over NOW. */
function tripDeadProvider(provider: string, status: number, errText: string): boolean {
  if (isQuotaDead(status, errText)) {
    deadUntil.set(provider, Date.now() + QUOTA_COOLDOWN_MS);
    console.warn(`[llm] ${provider} quota exhausted — cooling down 10min, failing over`);
    return true;
  }
  if (isBillingDead(status, errText)) {
    deadUntil.set(provider, Date.now() + BILLING_COOLDOWN_MS);
    console.warn(`[llm] ${provider} billing/auth failure (${status}) — cooling down 60min, failing over`);
    return true;
  }
  return false;
}

function breakerOpen(provider: string): boolean {
  const until = deadUntil.get(provider);
  if (until === undefined) return false;
  if (until <= Date.now()) {
    deadUntil.delete(provider);
    return false;
  }
  return true;
}

export interface LLMResult {
  text: string;
  tokens: number;
  latencyMs: number;
  model: string;
  provider: string;
  /** Prompt tokens as reported by the provider (cost capture). */
  inputTokens?: number;
  /** Cache-hit prompt tokens where the provider reports them (DeepSeek/Gemini). */
  cachedTokens?: number;
  /** Measured cost in USD from published price tables; null when unpriced. */
  costUsd?: number | null;
  /** Attempts spent across the retry/fallback plan (senior's attempt telemetry). */
  attempts?: number;
  /** Time-to-first-token in ms (streaming only) — null when unmeasured. */
  ttftMs?: number | null;
}

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOpts {
  tier?: "general" | "small";
  system?: string;
  prompt: string;
  /** Full conversation history (multi-turn, ported from intelligence-fabric).
   *  Sent as the message list with `prompt` as the final user turn. */
  history?: ChatTurn[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Explicit model override — honored by the OpenAI-compatible providers
   *  (deepseek/openrouter) for benchmark provider pinning. */
  model?: string;
  /** Per-provider attempt timeout. Keep under serverless limits so the
   *  provider chain can actually fail over inside the function window. */
  timeoutMs?: number;
}

type ProviderName = "gemini" | "groq" | "ollama" | "deepseek" | "openrouter" | "codecraft" | "cleanapis";

export function isLLMConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

function providerChain(): ProviderName[] {
  const primary = (process.env.LLM_PROVIDER ?? "gemini") as ProviderName;
  const all: ProviderName[] = [primary];
  if (process.env.GEMINI_API_KEY) all.push("gemini");
  if (process.env.GROQ_API_KEY) all.push("groq");
  // Near-free escalation rungs — off-peak DeepSeek (~$1.35/mo hobby scale),
  // then OpenRouter (one key, every pinned model incl. Claude/OpenAI), then
  // the CodeCraft free-plan proxy (Opus-class access, unverified SLA — last rung).
  if (process.env.DEEPSEEK_API_KEY) all.push("deepseek");
  if (process.env.OPENROUTER_API_KEY) all.push("openrouter");
  if (process.env.CODECRAFT_API_KEY) all.push("codecraft");
  if (process.env.CLEANAPIS_API_KEY) all.push("cleanapis");
  return [...new Set(all)].filter((p) => {
    if (p === "gemini") return Boolean(process.env.GEMINI_API_KEY);
    if (p === "groq") return Boolean(process.env.GROQ_API_KEY);
    if (p === "deepseek") return Boolean(process.env.DEEPSEEK_API_KEY);
    if (p === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY);
    if (p === "codecraft") return Boolean(process.env.CODECRAFT_API_KEY);
    if (p === "cleanapis") return Boolean(process.env.CLEANAPIS_API_KEY);
    if (p === "ollama") return true; // local default URL
    return false;
  });
}

/** Retryable status codes: rate limits and transient server errors. */
function retryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Multi-turn message builder (ported from intelligence-fabric openrouter.ts).
 * History ships as the message list, `prompt` is the final user turn.
 * Empty turns dropped; injected `system` roles in history stripped.
 */
function buildChatMessages(opts: LLMOpts): { role: string; content: string }[] {
  const history = (opts.history ?? []).filter(
    (m) => m.role !== "system" && m.content.trim().length > 0,
  );
  const messages: { role: string; content: string }[] = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    ...history,
  ];
  if (opts.prompt.trim()) messages.push({ role: "user", content: opts.prompt });
  return messages.length > 0 ? messages : [{ role: "user", content: opts.prompt }];
}

/** Exponential backoff between attempts: 600ms base, doubling, capped 2.5s. */
function backoffMs(attempt: number): number {
  return Math.min(600 * 2 ** attempt, 2500);
}

async function callGemini(opts: LLMOpts): Promise<LLMResult> {
  const key = process.env.GEMINI_API_KEY!;
  const model =
    process.env.GEMINI_MODEL ??
    (opts.tier === "small" ? "gemini-2.5-flash-lite" : "gemini-2.5-flash");

  const geminiContents = [
    ...(opts.history ?? [])
      .filter((m) => m.role !== "system" && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    { role: "user", parts: [{ text: opts.prompt }] },
  ];
  const body = JSON.stringify({
    ...(opts.system ? { system_instruction: { parts: [{ text: opts.system }] } } : {}),
    contents: geminiContents,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxTokens ?? 768,
      thinkingConfig: { thinkingBudget: 0 },
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  });

  let result: LLMResult | null = null;
  let lastErr: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
        if (isThrottled(res.status, errText) && attempt === 0) {
          if (tripDeadProvider("gemini", res.status, errText)) throw err;
          lastErr = err;
          await sleep(throttleDelayMs(errText));
          continue;
        }
        if (retryable(res.status) && attempt === 0) {
          lastErr = err;
          await sleep(1200);
          continue;
        }
        throw err;
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { candidatesTokenCount?: number; totalTokenCount?: number };
      };

      const text =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      result = {
        text: text.trim(),
        tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        latencyMs: Date.now() - started,
        model,
        provider: "gemini",
      };
      break;
    } catch (err) {
      lastErr = err;
      // Just tripped the quota/billing breaker (or it was already open):
      // retrying the same dead provider only burns the serverless window.
      if (breakerOpen("gemini")) throw err;
      // Network/timeout errors: one silent retry.
      if (attempt === 0) {
        await sleep(1200);
        continue;
      }
    }
  }

  if (!result) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  return result;
}

async function callGroq(opts: LLMOpts): Promise<LLMResult> {
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const body = JSON.stringify({
    model,
    messages: buildChatMessages(opts),
    temperature: opts.temperature ?? 0.4,
    max_tokens: Math.max(opts.maxTokens ?? 512, 768),
    reasoning_effort: "low",
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });

  let result: LLMResult | null = null;
  let lastErr: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY!}`,
        },
        body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(`Groq ${res.status}: ${errText.slice(0, 300)}`);
        if (isThrottled(res.status, errText) && attempt === 0) {
          if (tripDeadProvider("groq", res.status, errText)) throw err;
          lastErr = err;
          await sleep(throttleDelayMs(errText));
          continue;
        }
        if (retryable(res.status) && attempt === 0) {
          lastErr = err;
          await sleep(1200);
          continue;
        }
        throw err;
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { completion_tokens?: number };
      };

      result = {
        text: data.choices?.[0]?.message?.content?.trim() ?? "",
        tokens: data.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - started,
        model,
        provider: "groq",
      };
      break;
    } catch (err) {
      lastErr = err;
      if (breakerOpen("groq")) throw err;
      if (attempt === 0) {
        await sleep(1200);
        continue;
      }
    }
  }

  if (!result) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  return result;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible providers: DeepSeek (near-free off-peak) + OpenRouter
// (one key, every pinned model). Both capture full usage and assert on the
// response `model` field — free-tier routers silently swap models, which would
// poison any benchmark. The assertion turns a swap into a logged warning.
// ---------------------------------------------------------------------------

/** Published USD prices per 1M tokens (peak rates; conservative upper bound). */
const PRICE_TABLE: Record<string, { input: number; output: number; cachedInput?: number }> = {
  "deepseek-flash": { input: 0.3, output: 1.2, cachedInput: 0.006 },
  "deepseek/deepseek-v4.1-flash": { input: 0.045, output: 1.2, cachedInput: 0.01 },
  "nvidia/nemotron-3-super-120b-a12b:free": { input: 0, output: 0 },
  "anthropic/claude-sonnet-5.5": { input: 2.0, output: 10.0, cachedInput: 0.2 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "openai/gpt-oss-120b": { input: 0.15, output: 0.75 },
};

/** Measured cost in USD from the published price table; null when unpriced. */
export function estimateCostUsd(
  model: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
  cachedTokens: number | null | undefined = 0,
): number | null {
  const price = PRICE_TABLE[model];
  if (!price || !inputTokens || !outputTokens) return null;
  const cached = Math.min(cachedTokens ?? 0, inputTokens);
  const freshInput = inputTokens - cached;
  const cost =
    (freshInput / 1_000_000) * price.input +
    (cached / 1_000_000) * (price.cachedInput ?? price.input) +
    (outputTokens / 1_000_000) * price.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

interface OpenAICompatResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

async function callOpenAICompatible(
  kind: "deepseek" | "openrouter" | "codecraft" | "cleanapis",
  opts: LLMOpts,
): Promise<LLMResult> {
  const isDeepSeek = kind === "deepseek";
  const isCodeCraft = kind === "codecraft";
  const isCleanApis = kind === "cleanapis";
  const url = isDeepSeek
    ? DEEPSEEK_URL
    : isCodeCraft
      ? CODECRAFT_URL
      : isCleanApis
        ? CLEANAPIS_URL
        : OPENROUTER_URL;
  const key = isDeepSeek
    ? process.env.DEEPSEEK_API_KEY!
    : isCodeCraft
      ? process.env.CODECRAFT_API_KEY!
      : isCleanApis
        ? process.env.CLEANAPIS_API_KEY!
        : process.env.OPENROUTER_API_KEY!;
  const primaryModel = opts.model ?? (isDeepSeek
    ? process.env.DEEPSEEK_MODEL ?? "deepseek-flash"
    : isCodeCraft
      ? process.env.CODECRAFT_MODEL ?? "claude-opus-5"
      : isCleanApis
        ? process.env.CLEANAPIS_MODEL ?? "claude-opus-5"
        : process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4.1-flash");
  const label = isDeepSeek ? "DeepSeek" : isCodeCraft ? "CodeCraft" : isCleanApis ? "CleanApis" : "OpenRouter";

  // Attempt plan (ported from intelligence-fabric openrouter.ts): 2 tries per
  // model, max 4 total, exponential backoff. An explicit opts.model pins to
  // that model only (benchmark discipline — no silent fallback). Otherwise
  // the OpenRouter rung walks OPENROUTER_FALLBACK_MODELS (comma-separated).
  const plan: string[] = [];
  const pushModel = (m: string) => {
    for (let i = 0; i < 2 && plan.length < 4; i += 1) plan.push(m);
  };
  pushModel(primaryModel);
  if (!opts.model && kind === "openrouter") {
    const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const f of fallbacks) {
      if (plan.length >= 4) break;
      if (f !== primaryModel) pushModel(f);
    }
  }

  let result: LLMResult | null = null;
  let lastErr: unknown;
  let skipBackoff = false;

  for (const [attempt, model] of plan.entries()) {
    if (attempt > 0 && !skipBackoff) await sleep(backoffMs(attempt - 1));
    skipBackoff = false;
    const body = JSON.stringify({
      model,
      messages: buildChatMessages(opts),
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 768,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    });
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          // OpenRouter attribution headers (harmless for DeepSeek).
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://gravity.matrka.net",
          "X-Title": "GRAVITY",
        },
        body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
      });

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(`${label} ${res.status}: ${errText.slice(0, 300)}`);
        if (isThrottled(res.status, errText)) {
          if (tripDeadProvider(kind, res.status, errText)) throw err;
          lastErr = err;
          await sleep(throttleDelayMs(errText));
          skipBackoff = true;
          continue;
        }
        if (retryable(res.status)) {
          lastErr = err;
          continue;
        }
        throw err;
      }

      const data = (await res.json()) as OpenAICompatResponse;
      // Silent-swap guard: the response must be from the family we asked for.
      const served = data.model ?? model;
      if (served.split("/")[0] !== model.split("/")[0]) {
        console.warn(`[llm] ${label} model swap detected: asked ${model}, served ${served}`);
      }

      const inputTokens = data.usage?.prompt_tokens ?? null;
      const outputTokens = data.usage?.completion_tokens ?? null;
      const cachedTokens =
        data.usage?.prompt_cache_hit_tokens ?? data.usage?.prompt_tokens_details?.cached_tokens ?? 0;

      result = {
        text: data.choices?.[0]?.message?.content?.trim() ?? "",
        tokens: outputTokens ?? 0,
        latencyMs: Date.now() - started,
        model: served,
        provider: kind,
        inputTokens: inputTokens ?? undefined,
        cachedTokens: cachedTokens || undefined,
        costUsd: estimateCostUsd(model, inputTokens, outputTokens, cachedTokens),
        attempts: attempt + 1,
      };
      break;
    } catch (err) {
      lastErr = err;
      if (breakerOpen(kind)) throw err;
      // Network/timeout errors ride the backoff loop; nothing special here.
    }
  }

  if (!result) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  return result;
}

/**
 * Streaming variant for the OpenRouter rung (ported from
 * intelligence-fabric openrouter.ts `streamWithOpenRouter`).
 * Token deltas stream via onDelta; abort mid-flight with `signal`.
 * Same attempt plan as callOpenAICompatible; deltas fire only for the
 * winning attempt (failed attempts never emit partial text).
 * Not wired to any UI yet — chat-thread display is the next step.
 */
export async function streamOpenRouter(
  opts: LLMOpts & { onDelta: (chunk: string) => void; signal?: AbortSignal },
): Promise<LLMResult> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY_MISSING");
  const key = process.env.OPENROUTER_API_KEY;
  const primaryModel = opts.model ?? process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4.1-flash";

  const plan: string[] = [];
  const pushModel = (m: string) => {
    for (let i = 0; i < 2 && plan.length < 4; i += 1) plan.push(m);
  };
  pushModel(primaryModel);
  if (!opts.model) {
    for (const f of (process.env.OPENROUTER_FALLBACK_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      if (plan.length >= 4) break;
      if (f !== primaryModel) pushModel(f);
    }
  }

  let lastErr: unknown = new Error("stream failed");
  for (const [attempt, model] of plan.entries()) {
    if (opts.signal?.aborted) throw new Error("OPENROUTER_ABORTED");
    if (attempt > 0) await sleep(backoffMs(attempt - 1));
    const started = Date.now();
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://gravity.matrka.net",
          "X-Title": "GRAVITY",
        },
        body: JSON.stringify({
          model,
          messages: buildChatMessages(opts),
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? 768,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          stream: true,
          // Ask OpenRouter to append a usage chunk so chat can meter real
          // tokens + cost (absent on some models → stays honestly null).
          stream_options: { include_usage: true },
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        const err = new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
        if (retryable(res.status)) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let served = model;
      let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
      let ttftMs: number | null = null;
      try {
        for (;;) {
          if (opts.signal?.aborted) throw new Error("OPENROUTER_ABORTED");
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            let event: { model?: string; choices?: { delta?: { content?: string } }[]; error?: { message?: string }; usage?: { prompt_tokens?: number; completion_tokens?: number } };
            try {
              event = JSON.parse(data) as typeof event;
            } catch {
              continue;
            }
            if (event.error) throw new Error(`OpenRouter stream: ${event.error.message ?? "unknown"}`);
            if (event.model) served = event.model;
            if (event.usage) usage = event.usage;
            const delta = event.choices?.[0]?.delta?.content;
            if (delta) {
              if (ttftMs === null) ttftMs = Date.now() - started;
              text += delta;
              opts.onDelta(delta);
            }
          }
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      const finalText = text.trim();
      if (!finalText) throw new Error("OPENROUTER_EMPTY_RESPONSE");
      const inputTokens = usage?.prompt_tokens ?? null;
      const outputTokens = usage?.completion_tokens ?? null;
      return {
        text: finalText,
        tokens: outputTokens ?? 0,
        latencyMs: Date.now() - started,
        model: served,
        provider: "openrouter",
        attempts: attempt + 1,
        inputTokens: inputTokens ?? undefined,
        costUsd: estimateCostUsd(served, inputTokens, outputTokens, 0),
        ttftMs,
      };
    } catch (err) {
      if (err instanceof Error && err.message === "OPENROUTER_ABORTED") throw err;
      lastErr = err;
      if (err instanceof Error && !retryable(Number(/(\d{3})/.exec(err.message)?.[1] ?? 0))) {
        // Non-transient (auth, bad request, abort-shaped) — stop immediately.
        if (/OPENROUTER_ABORTED|API_KEY_MISSING|EMPTY_RESPONSE/.test(err.message)) throw err;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function callOllama(opts: LLMOpts): Promise<LLMResult> {
  const base = process.env.OLLAMA_URL ?? "http://localhost:11434";
  const model = opts.tier === "small"
    ? process.env.OLLAMA_SMALL_MODEL ?? "deepseek-coder:6.7b"
    : process.env.OLLAMA_GENERAL_MODEL ?? "llama3:latest";
  const started = Date.now();

  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      system: opts.system,
      prompt: opts.prompt,
      format: opts.json ? "json" : undefined,
      options: { temperature: opts.temperature ?? 0.4, num_predict: opts.maxTokens ?? 512 },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as { response?: string; eval_count?: number };
  return {
    text: data.response?.trim() ?? "",
    tokens: data.eval_count ?? 0,
    latencyMs: Date.now() - started,
    model,
    provider: "ollama",
  };
}

const runners: Record<ProviderName, (o: LLMOpts) => Promise<LLMResult>> = {
  gemini: callGemini,
  groq: callGroq,
  ollama: callOllama,
  deepseek: (o) => callOpenAICompatible("deepseek", o),
  openrouter: (o) => callOpenAICompatible("openrouter", o),
  codecraft: (o) => callOpenAICompatible("codecraft", o),
  cleanapis: (o) => callOpenAICompatible("cleanapis", o),
};

/** Run ONE provider with NO fallback chain — the benchmark spec's "pin the provider". */
export async function callLLMPinned(provider: ProviderName, opts: LLMOpts): Promise<LLMResult> {
  return runners[provider](opts);
}

export async function callLLM(opts: LLMOpts): Promise<LLMResult> {
  const chain = providerChain();
  if (chain.length === 0) {
    throw new Error("No LLM provider configured. Set GEMINI_API_KEY or GROQ_API_KEY.");
  }

  let lastError: unknown;
  for (const provider of chain) {
    if (breakerOpen(provider)) {
      console.warn(`[llm] ${provider} breaker open — skipping to next provider`);
      continue;
    }
    try {
      return await runners[provider](opts);
    } catch (err) {
      lastError = err;
      console.warn(`[llm] ${provider} failed, trying next…`, String(err).slice(0, 200));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
