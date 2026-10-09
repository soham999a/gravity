"use client";

import * as React from "react";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  model?: string;
  ms?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMsg[];
  /** Per-thread model override (OpenRouter slug) — undefined = default workhorse. */
  model?: string;
  pinned?: boolean;
}

/** Picker rungs the client may offer — the server allowlists the same set. */
export const CHAT_MODELS = [
  { slug: "", label: "Auto workhorse" },
  { slug: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4 Flash" },
  { slug: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5" },
  { slug: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
] as const;

const STORAGE_KEY = "gravity.chat.v1";
const MAX_THREADS = 30;

function load(): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ChatThread[];
    return Array.isArray(arr) ? arr.slice(0, MAX_THREADS) : [];
  } catch {
    return [];
  }
}

function titleFrom(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 42) || "New chat";
}

async function readSSE(
  res: Response,
  onDelta: (chunk: string) => void,
  signal: AbortSignal,
): Promise<{ model?: string; error?: string; inputTokens?: number | null; outputTokens?: number | null; costUsd?: number | null }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("no stream body");
  const decoder = new TextDecoder();
  let buffer = "";
  let meta: { model?: string; error?: string; inputTokens?: number | null; outputTokens?: number | null; costUsd?: number | null } = {};
  for (;;) {
    if (signal.aborted) throw new Error("STOPPED");
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const evt = JSON.parse(data) as { delta?: string; done?: boolean; model?: string; error?: string; inputTokens?: number | null; outputTokens?: number | null; costUsd?: number | null };
        if (typeof evt.delta === "string" && evt.delta) onDelta(evt.delta);
        if (evt.done) {
          meta = {
            ...meta,
            model: evt.model,
            inputTokens: evt.inputTokens ?? null,
            outputTokens: evt.outputTokens ?? null,
            costUsd: evt.costUsd ?? null,
          };
        }
        if (evt.error) meta = { ...meta, error: evt.error };
      } catch {
        /* partial line — next chunk completes it */
      }
    }
  }
  return meta;
}

/**
 * Persistent chat threads (localStorage) + streaming send/stop/retry/variation.
 * This is what ACTIVATES the ported multi-turn algo: every send ships the
 * full thread as real history turns, not a glued blob.
 */
export function useChatThreads() {
  const [threads, setThreads] = React.useState<ChatThread[]>(() => load());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<"idle" | "streaming" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, MAX_THREADS)));
    } catch {
      /* quota — ephemeral this session */
    }
  }, [threads ]);

  const active = threads.find((t) => t.id === activeId) ?? null;

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const newThread = React.useCallback((): string => {
    // Reuse an existing empty draft instead of piling up "New chat" zombies.
    let existing: string | null = null;
    setThreads((prev) => {
      const empty = prev.find((t) => t.messages.length === 0);
      if (empty) {
        existing = empty.id;
        return prev;
      }
      const id = `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      existing = id;
      return [{ id, title: "New chat", createdAt: new Date().toISOString(), messages: [] }, ...prev].slice(0, MAX_THREADS);
    });
    const id = existing ?? "";
    setActiveId(id || null);
    setPhase("idle");
    setError(null);
    return id;
  }, []);

  const removeThread = React.useCallback(
    (id: string) => {
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setPhase("idle");
      }
    },
    [activeId],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = React.useCallback(
    async (text: string, opts?: { temperature?: number; variation?: boolean; threadId?: string; model?: string }) => {
      const prompt = text.trim();
      if (!prompt || phase === "streaming") return;
      let tid = opts?.threadId ?? activeId;
      if (!tid) tid = newThread();
      const targetId = tid;
      const temp = opts?.temperature ?? (opts?.variation ? 0.9 : 0.4);
      // Per-thread model wins; explicit opt overrides for one shot.
      const threadModel = threads.find((t) => t.id === targetId)?.model;
      const model = opts?.model ?? threadModel ?? undefined;
      const userContent = opts?.variation
        ? `${prompt}\n\n(Give a distinctly different take from your previous answer.)`
        : prompt;

      setPhase("streaming");
      setError(null);
      setElapsedMs(0);
      const t0 = Date.now();
      stopTimer();
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - t0), 250);

      // Snapshot history BEFORE appending (assistant reply not yet there).
      let history: ChatMsg[] = [];
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== targetId) return t;
          history = t.messages;
          const title = t.messages.length === 0 ? titleFrom(prompt) : t.title;
          return { ...t, title, messages: [...t.messages, { role: "user", content: userContent }] };
        }),
      );
      // Placeholder assistant turn; deltas append into it.
      setThreads((prev) =>
        prev.map((t) =>
          t.id === targetId ? { ...t, messages: [...t.messages, { role: "assistant", content: "" }] } : t,
        ),
      );

      const controller = new AbortController();
      abortRef.current = controller;
      const appendDelta = (chunk: string) =>
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id !== targetId) return t;
            const msgs = [...t.messages];
            const last = msgs[msgs.length - 1];
            if (!last || last.role !== "assistant") return t;
            msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
            return { ...t, messages: msgs };
          }),
        );

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            messages: [...history, { role: "user", content: userContent }],
            temperature: temp,
            ...(model ? { model } : {}),
          }),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const meta = await readSSE(res, appendDelta, controller.signal);
        if (meta.error) throw new Error(meta.error);
        const ms = Date.now() - t0;
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id !== targetId) return t;
            const msgs = [...t.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              msgs[msgs.length - 1] = {
                ...last,
                model: meta.model,
                ms,
                inputTokens: meta.inputTokens ?? null,
                outputTokens: meta.outputTokens ?? null,
                costUsd: meta.costUsd ?? null,
              };
            }
            return { ...t, messages: msgs };
          }),
        );
        setPhase("idle");
      } catch (err) {
        const stopped = controller.signal.aborted;
        // Keep partial text on stop; drop the empty placeholder on hard error.
        if (!stopped) {
          setThreads((prev) =>
            prev.map((t) => {
              if (t.id !== targetId) return t;
              const msgs = [...t.messages];
              const last = msgs[msgs.length - 1];
              if (last && last.role === "assistant" && !last.content) return { ...t, messages: msgs.slice(0, -1) };
              return t;
            }),
          );
          setPhase("error");
          setError(err instanceof Error ? err.message : "chat failed");
        } else {
          setPhase("idle");
        }
      } finally {
        stopTimer();
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [activeId, newThread, phase, threads],
  );

  /** Pin/unpin a thread (pinned sort first). */
  const togglePin = React.useCallback((id: string) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
  }, []);

  /** Per-thread model override (OpenRouter slug, "" clears to Auto). */
  const setThreadModel = React.useCallback((id: string, model: string) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, model: model || undefined } : t)),
    );
  }, []);

  /** Resend the last user turn (same history, no duplicate user message). */
  const retry = React.useCallback(() => {
    const t = threads.find((x) => x.id === activeId);
    if (!t || phase === "streaming") return;
    const withoutLastPair = [...t.messages];
    // Drop trailing assistant (empty or not) + its user turn, then re-send.
    if (withoutLastPair[withoutLastPair.length - 1]?.role === "assistant") withoutLastPair.pop();
    const userTurn = withoutLastPair.pop();
    if (!userTurn || userTurn.role !== "user") return;
    setThreads((prev) => prev.map((x) => (x.id === activeId ? { ...x, messages: withoutLastPair } : x)));
    // Strip a variation suffix if the retried turn was one.
    const clean = userTurn.content.replace(/\n\n\(Give a distinctly different take.*$/, "");
    void send(clean, { threadId: activeId ?? undefined });
  }, [threads, activeId, phase, send]);

  const variation = React.useCallback(() => {
    const t = threads.find((x) => x.id === activeId);
    if (!t || phase === "streaming") return;
    const lastUser = [...t.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const clean = lastUser.content.replace(/\n\n\(Give a distinctly different take.*$/, "");
    void send(clean, { variation: true, threadId: activeId ?? undefined });
  }, [threads, activeId, phase, send]);

  React.useEffect(() => () => stopTimer(), []);

  return { threads, active, activeId, setActiveId, newThread, removeThread, send, stop, retry, variation, togglePin, setThreadModel, phase, error, elapsedMs };
}
