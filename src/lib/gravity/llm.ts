const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface LLMResult {
  text: string;
  tokens: number;
  latencyMs: number;
  model: string;
  provider: string;
}

export interface LLMOpts {
  tier?: "general" | "small";
  system?: string;
  prompt: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

type ProviderName = "gemini" | "groq" | "ollama";

function providerChain(): ProviderName[] {
  const primary = (process.env.LLM_PROVIDER ?? "gemini") as ProviderName;
  const all: ProviderName[] = [primary];
  if (process.env.GEMINI_API_KEY) all.push("gemini");
  if (process.env.GROQ_API_KEY) all.push("groq");
  return [...new Set(all)].filter((p) => {
    if (p === "gemini") return Boolean(process.env.GEMINI_API_KEY);
    if (p === "groq") return Boolean(process.env.GROQ_API_KEY);
    if (p === "ollama") return Boolean(process.env.OLLAMA_URL || true);
    return false;
  });
}

async function callGemini(opts: LLMOpts): Promise<LLMResult> {
  const key = process.env.GEMINI_API_KEY!;
  const model =
    process.env.GEMINI_MODEL ??
    (opts.tier === "small" ? "gemini-2.5-flash-lite" : "gemini-2.5-flash");
  const started = Date.now();

  const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(opts.system ? { system_instruction: { parts: [{ text: opts.system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxTokens ?? 768,
        thinkingConfig: { thinkingBudget: 0 },
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { candidatesTokenCount?: number; totalTokenCount?: number };
  };

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return {
    text: text.trim(),
    tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    latencyMs: Date.now() - started,
    model,
    provider: "gemini",
  };
}

async function callGroq(opts: LLMOpts): Promise<LLMResult> {
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const started = Date.now();

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY!}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.prompt },
      ],
      temperature: opts.temperature ?? 0.4,
      max_tokens: Math.max(opts.maxTokens ?? 512, 768),
      reasoning_effort: "low",
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { completion_tokens?: number };
  };

  return {
    text: data.choices?.[0]?.message?.content?.trim() ?? "",
    tokens: data.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - started,
    model,
    provider: "groq",
  };
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
    signal: AbortSignal.timeout(180_000),
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
};

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
