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
}

export interface LLMOpts {
  tier?: "general" | "small";
  system?: string;
  prompt: string;
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

async function callGemini(opts: LLMOpts): Promise<LLMResult> {
  const key = process.env.GEMINI_API_KEY!;
  const model =
    process.env.GEMINI_MODEL ??
    (opts.tier === "small" ? "gemini-2.5-flash-lite" : "gemini-2.5-flash");

  const body = JSON.stringify({
    ...(opts.system ? { system_instruction: { parts: [{ text: opts.system }] } } : {}),
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
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
    messages: [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content: opts.prompt },
    ],
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
  const model = opts.model ?? (isDeepSeek
    ? process.env.DEEPSEEK_MODEL ?? "deepseek-flash"
    : isCodeCraft
      ? process.env.CODECRAFT_MODEL ?? "claude-opus-5"
      : isCleanApis
        ? process.env.CLEANAPIS_MODEL ?? "claude-opus-5"
        : process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4.1-flash");
  const label = isDeepSeek ? "DeepSeek" : isCodeCraft ? "CodeCraft" : isCleanApis ? "CleanApis" : "OpenRouter";

  const body = JSON.stringify({
    model,
    messages: [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content: opts.prompt },
    ],
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 768,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });

  let result: LLMResult | null = null;
  let lastErr: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
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
        if (isThrottled(res.status, errText) && attempt === 0) {
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
      };
      break;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        await sleep(1200);
        continue;
      }
    }
  }

  if (!result) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  return result;
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
    try {
      return await runners[provider](opts);
    } catch (err) {
      lastError = err;
      console.warn(`[llm] ${provider} failed, trying next…`, String(err).slice(0, 200));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
