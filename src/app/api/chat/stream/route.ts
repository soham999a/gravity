import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { streamOpenRouter } from "@/lib/gravity/llm";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * POST /api/chat/stream — ChatGPT-style token streaming for chat threads.
 * Body: { messages: ChatMessage[], temperature?: number, model?: string }
 * SSE events: data: {"delta":"..."} … data: {"done":true,"model":"...","attempts":n,"inputTokens":n,"outputTokens":n,"costUsd":n}
 * Errors: data: {"error":"..."} (still 200 so the reader always parses).
 * Uses the paid OpenRouter workhorse; history rides as real turns (the
 * multi-turn algo ported from intelligence-fabric). `model` is validated
 * against a tight allowlist — never a raw client string to the provider.
 */
export async function POST(request: Request) {
  const ctx = await verifyAuthToken(request as never);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { checkRateLimit, rateLimitKey } = await import("@/lib/rate-limit");
  const rl = checkRateLimit(`chat:${rateLimitKey(request, ctx.uid)}`, 30, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "chat rate limited — 30 per 10 minutes" }, { status: 429 });
  }

  let body: { messages?: ChatMessage[]; temperature?: number; model?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const messages = (body.messages ?? []).filter(
    (m) => m && typeof m.content === "string" && m.content.trim().length > 0,
  );
  if (messages.length === 0 || messages.length > 50) {
    return NextResponse.json({ error: "messages must have 1-50 non-empty turns" }, { status: 400 });
  }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "messages must include a user turn" }, { status: 400 });
  }
  const temperature = Number.isFinite(body.temperature)
    ? Math.min(1.5, Math.max(0, Number(body.temperature)))
    : 0.4;

  // Per-thread model picker — allowlist only: env primary + env fallbacks +
  // two curated rungs. Anything else falls back to the default workhorse.
  const envModels = [
    process.env.OPENROUTER_MODEL,
    ...(process.env.OPENROUTER_FALLBACK_MODELS ?? "").split(",").map((s) => s.trim()),
  ].filter(Boolean) as string[];
  const CURATED = ["anthropic/claude-sonnet-5.5", "openai/gpt-oss-120b"];
  const allowed = new Set([...envModels, ...CURATED]);
  const model = typeof body.model === "string" && allowed.has(body.model) ? body.model : undefined;

  const history = messages.slice(0, messages.lastIndexOf(lastUser));
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const result = await streamOpenRouter({
          tier: "general",
          system:
            "You are GRAVITY, a sharp senior operator. Answer directly with clean markdown. " +
            "No preamble about yourself, no filler.",
          prompt: lastUser.content.slice(0, 4000),
          history: history.map((m) => ({
            role: m.role,
            content: m.content.slice(0, 4000),
          })),
          maxTokens: 1500,
          temperature,
          model,
          timeoutMs: 55_000,
          onDelta: (chunk) => send({ delta: chunk }),
        });
        send({
          done: true,
          model: result.model,
          attempts: result.attempts ?? 1,
          inputTokens: result.inputTokens ?? null,
          outputTokens: result.tokens || null,
          costUsd: result.costUsd ?? null,
        });
      } catch (err) {
        send({ error: err instanceof Error ? err.message.slice(0, 300) : "chat failed" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
