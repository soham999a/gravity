"use client";

import * as React from "react";
import {
  ArrowRight,
  Check,
  Copy,
  LoaderCircle,
  Mic,
  MicOff,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Wand2,
} from "lucide-react";
import { Markdown } from "./Markdown";
import { CHAT_MODELS, useChatThreads } from "@/lib/chatThreads";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const STARTERS = [
  { label: "Explain", prompt: "Explain black holes in simple words with one everyday analogy." },
  { label: "Compare", prompt: "Compare freelancing vs a full-time job in a table: income, freedom, risk." },
  { label: "Plan", prompt: "Make me a focused 7-day plan to learn the basics of investing, 30 minutes a day." },
] as const;

const FOLLOW_UPS = [
  "Explain it simpler",
  "Give an example",
  "Go deeper",
  "Summarize in 3 bullets",
] as const;

function followUpPrompt(chip: string): string {
  switch (chip) {
    case "Explain it simpler":
      return "Explain your last answer more simply, like I'm new to this.";
    case "Give an example":
      return "Give a concrete example for your last answer.";
    case "Go deeper":
      return "Go deeper on your last answer — more detail and nuance.";
    case "Summarize in 3 bullets":
      return "Summarize your last answer in exactly 3 bullets.";
    default:
      return chip;
  }
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/**
 * Voice input is PARKED (browser permission friction killed it in testing).
 * Flip to true to bring back the mic button + primer + blocked card — all
 * logic stays wired. Everything else (chat, picker, meter) is untouched.
 */
const VOICE_ENABLED = false;

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

/**
 * ChatGPT-style thread surface: persistent sidebar, streaming bubbles,
 * stop / retry / variation, in-thread refine. Quick text answers ride the
 * paid OpenRouter workhorse with REAL multi-turn history (not glued blobs).
 */
export function ChatThread({ onRequireAuth, authed }: { onRequireAuth: () => void; authed: boolean }) {
  const chat = useChatThreads();
  const { active } = chat;
  const [draft, setDraft] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);
  const [listening, setListening] = React.useState(false);
  const [micError, setMicError] = React.useState<string | null>(null);
  const [micBlocked, setMicBlocked] = React.useState(false);
  const [micPriming, setMicPriming] = React.useState(false);
  const [hearing, setHearing] = React.useState("");
  const [micDiag, setMicDiag] = React.useState<string | null>(null);

  /** One-click mic diagnosis: prints what the browser actually reports. */
  const diagnoseMic = async () => {
    const bits: string[] = [];
    try {
      bits.push(`secure=${window.isSecureContext ? "yes" : "NO"}`);
    } catch {
      bits.push("secure=?");
    }
    bits.push(`mediaDevices=${typeof navigator.mediaDevices !== "undefined" ? "yes" : "NO"}`);
    try {
      const status = await navigator.permissions?.query(
        { name: "microphone" } as PermissionDescriptor,
      );
      bits.push(`permission=${status?.state ?? "?"}`);
    } catch {
      bits.push("permission=?");
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === "audioinput").length;
      bits.push(`mics=${mics}`);
    } catch {
      bits.push("mics=?");
    }
    const sr = getSpeechRecognition();
    bits.push(`speechAPI=${sr ? "yes" : "NO"}`);
    setMicDiag(bits.join(" · "));
  };
  // Mounted gate: localStorage threads + mic support exist client-side only.
  // Server renders without them — first client render must match exactly.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const recogRef = React.useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = React.useMemo(() => getSpeechRecognition() !== null, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length, chat.phase]);

  // Auto-grow the composer (giant-grade textarea, capped).
  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft, active?.id]);

  // Stop mic on unmount.
  React.useEffect(() => () => recogRef.current?.stop(), []);

  const submit = (text: string) => {
    if (!authed) {
      onRequireAuth();
      return;
    }
    setDraft("");
    setMicError(null);
    setMicBlocked(false);
    setHearing("");
    void chat.send(text);
  };

  const copyMessage = async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1400);
    } catch {
      /* clipboard denied */
    }
  };

  const startListening = async () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setMicBlocked(false);
      setMicError("Voice not supported in this browser — try Chrome.");
      return;
    }
    setMicError(null);
    setMicBlocked(false);
    setMicPriming(false);
    // Ask for the mic UP FRONT via getUserMedia: a user-gesture call pops the
    // browser permission prompt right on click. SpeechRecognition alone won't
    // re-prompt once denied — it just fails silent/blocked.
    try {
      // Pre-check: 'denied' means Chrome will never re-prompt — send the user
      // to settings instead of a doomed request. 'prompt'/'granted' proceed.
      try {
        const status = await navigator.permissions?.query(
          { name: "microphone" } as PermissionDescriptor,
        );
        if (status?.state === "denied") {
          setMicBlocked(true);
          setMicError("Microphone is blocked");
          return;
        }
      } catch {
        /* permissions API unavailable — fall through to the request */
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission granted — we only needed the gate, release the mic at once.
      stream.getTracks().forEach((t) => t.stop());
      try {
        window.localStorage.setItem("gravity.mic.primed", "1");
      } catch {
        /* private mode — prime every time, harmless */
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        setMicBlocked(false);
        setMicError("No microphone found on this device — plug one in and retry.");
      } else if (name === "NotReadableError" || name === "AbortError") {
        setMicBlocked(false);
        setMicError("Mic is busy — close Meet/Zoom/recorder apps using it, then retry.");
      } else {
        setMicBlocked(true);
        setMicError("Microphone is blocked");
      }
      return;
    }
    try {
      const recog = new Ctor();
      recog.lang = "en-US";
      recog.continuous = false;
      recog.interimResults = true;
      recog.onresult = (event) => {
        let interim = "";
        const finals: string[] = [];
        const results = event.results;
        for (let i = 0; i < results.length; i += 1) {
          const best = results[i]?.[0];
          if (!best) continue;
          // isFinal lives on the RESULT, not the alternative — read via index signature.
          const isFinal = (results[i] as unknown as { isFinal?: boolean })?.isFinal === true;
          if (isFinal) finals.push(best.transcript);
          else interim += best.transcript;
        }
        if (finals.join("").trim()) {
          setDraft((d) => (d ? `${d} ${finals.join(" ").trim()}` : finals.join(" ").trim()));
        }
        setHearing(interim.trim());
      };
      recog.onerror = (event) => {
        const code = event.error ?? "unknown";
        if (code === "not-allowed" || code === "service-not-allowed") {
          setMicBlocked(true);
          setMicError("Microphone is blocked");
        } else {
          setMicBlocked(false);
          setMicError(
            code === "no-speech"
              ? "Didn't catch that — speak and try again."
              : "Mic hiccup — try again.",
          );
        }
        setListening(false);
        setHearing("");
      };
      recog.onend = () => {
        setListening(false);
        setHearing("");
      };
      recogRef.current = recog;
      recog.start();
      setListening(true);
    } catch {
      setListening(false);
      setMicError("Couldn't start the mic — try again.");
    }
  };

  /**
   * Meet/Duolingo primer pattern: first-timers get a one-line WHY card with
   * an explicit Enable button (informed users allow; blind prompts get
   * blocked). Returning users go straight to the mic. Stop button included.
   */
  const toggleMic = () => {
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      setHearing("");
      return;
    }
    let primed = false;
    try {
      primed = window.localStorage.getItem("gravity.mic.primed") === "1";
    } catch {
      primed = false;
    }
    if (!primed) {
      setMicError(null);
      setMicBlocked(false);
      setMicPriming(true);
      return;
    }
    void startListening();
  };

  // Sidebar: pinned first, then search filter (title match).
  // threadsForRender freezes to [] until mount: the server renders zero
  // threads, so the first client paint must too — otherwise hydration blows
  // up for anyone with saved chats (same as the search/mic gates above).
  const threadsForRender = mounted ? chat.threads : [];
  const visibleThreads = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...threadsForRender].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
    if (!q) return sorted;
    return sorted.filter((t) => t.title.toLowerCase().includes(q));
  }, [threadsForRender, search]);

  // Thread totals: real measured tokens + cost (null-safe, honest).
  const totals = React.useMemo(() => {
    if (!active) return { tokens: 0, cost: null as number | null, measured: false };
    let tokens = 0;
    let cost = 0;
    let measured = false;
    for (const m of active.messages) {
      if (m.role !== "assistant") continue;
      tokens += (m.inputTokens ?? 0) + (m.outputTokens ?? 0);
      if (typeof m.costUsd === "number") {
        cost += m.costUsd;
        measured = true;
      }
    }
    return { tokens, cost: measured ? cost : null, measured };
  }, [active]);

  const lastIsAssistant =
    !!active && active.messages.length > 0 && active.messages[active.messages.length - 1]?.role === "assistant";

  // Brave needs an extra Shields step — read client-side only (hydration-safe).
  const isBrave =
    mounted &&
    typeof navigator !== "undefined" &&
    Boolean((navigator as unknown as Record<string, unknown>).brave);

  return (
    <div className="chat-bone grid gap-4 md:grid-cols-[220px_1fr]">
      {/* ── Sidebar ── */}
      <aside className="rounded-lg border border-border bg-surface p-3">
        <button
          type="button"
          onClick={() => chat.newThread()}
          className="studio-secondary-button w-full"
        >
          <Plus className="size-3.5" /> New chat
        </button>
        {threadsForRender.length > 3 ? (
          <label className="mt-3 flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
            <Search className="size-3.5 shrink-0 text-ivory-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="chat-search w-full bg-transparent text-xs text-ivory outline-none"
            />
          </label>
        ) : null}
        <div className="mt-3 space-y-1">
          {threadsForRender.length === 0 ? (
            <p className="meta px-1 py-2">No chats yet — start one.</p>
          ) : visibleThreads.length === 0 ? (
            <p className="meta px-1 py-2">No match for “{search.trim()}”.</p>
          ) : (
            visibleThreads.map((t) => {
              const turns = Math.ceil(t.messages.length / 2);
              const isEmpty = t.messages.length === 0;
              return (
              <div
                key={t.id}
                className={cn(
                  "chat-row group flex items-center gap-1.5 rounded-md px-2 py-1.5",
                  t.id === chat.activeId ? "bg-gold-pale" : "hover:bg-surface",
                )}
              >
                {t.pinned ? <Pin className="size-3 shrink-0 text-gold" /> : null}
                <button
                  type="button"
                  onClick={() => chat.setActiveId(t.id)}
                  className="min-w-0 flex-1 text-left"
                  title={isEmpty ? "Empty draft — continue writing" : t.title}
                >
                  <span className={cn("block truncate text-sm leading-snug", isEmpty ? "italic text-ivory-faint" : "text-ivory")}>
                    {isEmpty ? "Empty draft" : t.title}
                  </span>
                  <span className="meta">
                    {isEmpty ? `${timeAgo(t.createdAt)} · draft` : `${timeAgo(t.createdAt)} · ${turns} turn${turns === 1 ? "" : "s"}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => chat.togglePin(t.id)}
                  className={cn("shrink-0 p-1", t.pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                  title={t.pinned ? "Unpin chat" : "Pin chat"}
                >
                  <Pin className={cn("size-3.5", t.pinned ? "text-gold" : "text-ivory-faint")} />
                </button>
                {confirmDelete === t.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      chat.removeThread(t.id);
                      setConfirmDelete(null);
                    }}
                    className="meta shrink-0 text-danger-text"
                    title="Confirm delete"
                  >
                    Sure?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(t.id)}
                    className="shrink-0 p-1 opacity-0 group-hover:opacity-100"
                    title="Delete chat"
                  >
                    <Trash2 className="size-3.5 text-ivory-faint" />
                  </button>
                )}
              </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Thread ── */}
      <div className="rounded-lg border border-border bg-surface p-4">
        {!active ? (
          <div className="py-10 text-center">
            <p className="text-sm text-ivory">Ask anything — answers stream in like chat.</p>
            <p className="meta mt-2">Heavy jobs (images, sites, data) still go through Create above.</p>
            <button type="button" onClick={() => chat.newThread()} className="studio-primary-button mt-4 px-4 py-2">
              Start chatting
            </button>
          </div>
        ) : (
          <>
            {/* ── Model picker + live meter ── */}
            <div className="chat-meter mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="meta flex items-center gap-2">
                BRAIN
                <select
                  value={active.model ?? ""}
                  onChange={(e) => chat.setThreadModel(active.id, e.target.value)}
                  className="rounded border border-border bg-surface px-2 py-1 text-ivory"
                  title="Model for this thread (applies to new answers)"
                >
                  {CHAT_MODELS.map((m) => (
                    <option key={m.slug || "auto"} value={m.slug}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="meta">
                {totals.tokens > 0 ? `${(totals.tokens / 1000).toFixed(1)}k tok` : "— tok"}
                {totals.cost !== null ? ` · $${totals.cost.toFixed(4)}` : ""}
              </span>
            </div>
            <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1 chat-scroll">
              {active.messages.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="meta">First message sets the title. History ships as real turns.</p>
                  <div className="mt-4 grid gap-2 text-left">
                    {STARTERS.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => submit(s.prompt)}
                        className="chat-starter"
                      >
                        <span className="chat-starter-label">{s.label}</span>
                        <span className="chat-starter-text">{s.prompt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                active.messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="group flex justify-end">
                      <div className="max-w-[85%] rounded-lg bg-gold-pale px-3 py-2 text-sm text-ivory">
                        {m.content}
                        <button
                          type="button"
                          onClick={() => copyMessage(m.content, i)}
                          className="meta ml-2 hidden items-center gap-1 group-hover:inline-flex hover:text-gold"
                          title="Copy message"
                        >
                          {copiedIdx === i ? <Check className="size-3" /> : <Copy className="size-3" />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="rounded-lg border border-border-light px-3 py-2">
                      {m.content ? (
                        <>
                          <Markdown>{m.content}</Markdown>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {m.model || m.ms ? (
                              <p className="meta">
                                {m.model ? m.model.split("/").pop() : ""}{m.model && m.ms ? " · " : ""}{m.ms ? `${(m.ms / 1000).toFixed(1)}s` : ""}
                                {(m.inputTokens ?? 0) + (m.outputTokens ?? 0) > 0
                                  ? ` · ${(((m.inputTokens ?? 0) + (m.outputTokens ?? 0)) / 1000).toFixed(1)}k tok`
                                  : ""}
                                {typeof m.costUsd === "number" ? ` · $${m.costUsd.toFixed(4)}` : ""}
                              </p>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => copyMessage(m.content, i)}
                              className="meta flex items-center gap-1 hover:text-gold"
                              title="Copy answer"
                            >
                              {copiedIdx === i ? <Check className="size-3" /> : <Copy className="size-3" />}
                              {copiedIdx === i ? "COPIED" : "COPY"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <span className="meta flex items-center gap-2 chat-thinking">
                          <LoaderCircle className="size-3.5 animate-spin" /> thinking…
                        </span>
                      )}
                    </div>
                  ),
                )
              )}
              <div ref={bottomRef} />
            </div>

            {/* ── Follow-up chips ── */}
            {chat.phase !== "streaming" && lastIsAssistant ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {FOLLOW_UPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => submit(followUpPrompt(chip))}
                    className="chat-chip"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            ) : null}

            {chat.phase === "streaming" ? (
              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={chat.stop} className="studio-secondary-button">
                  <Square className="size-3.5" /> Stop {(chat.elapsedMs / 1000).toFixed(1)}s
                </button>
                <span className="meta">ESC stops too — partial text is kept</span>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {active.messages.length > 0 ? (
                  <>
                    <button type="button" onClick={chat.retry} className="studio-secondary-button" title="Regenerate same answer">
                      <RotateCcw className="size-3.5" /> Retry
                    </button>
                    <button type="button" onClick={chat.variation} className="studio-secondary-button" title="A distinctly different take">
                      <Wand2 className="size-3.5" /> Variation
                    </button>
                  </>
                ) : null}
                {chat.phase === "error" && chat.error ? (
                  <span className="danger-text text-xs">Failed: {chat.error}</span>
                ) : null}
              </div>
            )}

            {/* Meet-style mic states: primer, blocked card, or live status */}
            {micPriming ? (
              <div className="chat-mic-blocked">
                <div className="chat-mic-blocked-icon">
                  <Mic className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="chat-mic-blocked-title">Talk instead of type</p>
                  <p className="chat-mic-blocked-sub">
                    Your voice is only used to write the message — nothing is stored.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void startListening()} className="studio-primary-button px-3 py-1.5">
                      Enable microphone
                    </button>
                    <button
                      type="button"
                      onClick={() => setMicPriming(false)}
                      className="meta hover:text-gold"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              </div>
            ) : micError && !listening ? (
              <div className="chat-mic-blocked">
                <div className="chat-mic-blocked-icon">
                  <MicOff className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="chat-mic-blocked-title">{micError ?? "Microphone is blocked"}</p>
                  {micBlocked ? (
                    <ol className="chat-mic-blocked-steps">
                      {isBrave ? <li>Lion icon → Shields DOWN for this site</li> : null}
                      <li>Click the lock/tune icon in the address bar</li>
                      <li>Microphone → Allow, then come back here</li>
                    </ol>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={toggleMic} className="studio-secondary-button px-3 py-1.5">
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={diagnoseMic}
                      className="meta underline decoration-gold-dim underline-offset-4 hover:text-gold"
                    >
                      WHY?
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMicError(null); setMicBlocked(false); setMicDiag(null); }}
                      className="meta hover:text-gold"
                    >
                      Dismiss
                    </button>
                  </div>
                  {micDiag ? (
                    <p className="meta mt-1.5 break-all">DIAG · {micDiag}</p>
                  ) : null}
                </div>
              </div>
            ) : (listening || hearing) ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="chat-mic-pulse" aria-hidden="true" />
                <span className="meta">
                  {hearing ? `hearing: “${hearing}…”` : "listening… speak now"}
                </span>
              </div>
            ) : null}
            <form
              className="mt-3 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) submit(draft);
              }}
            >
              <textarea
                ref={inputRef}
                value={draft}
                rows={1}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (draft.trim() && chat.phase !== "streaming") submit(draft);
                  }
                  if (e.key === "Escape" && chat.phase === "streaming") chat.stop();
                }}
                placeholder={active.messages.length === 0 ? "Ask anything… (Enter sends · Shift+Enter newline)" : "Refine in this thread…"}
                className="chat-composer flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-ivory"
                disabled={chat.phase === "streaming"}
              />
              {mounted && speechSupported && VOICE_ENABLED ? (
                <button
                  type="button"
                  onClick={toggleMic}
                  title={listening ? "Stop listening" : "Speak instead of typing"}
                  className={cn("studio-secondary-button px-3 py-2", listening && "chat-mic-live")}
                >
                  {listening ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
                </button>
              ) : null}
              <button type="submit" disabled={!draft.trim() || chat.phase === "streaming"} className="studio-primary-button px-4 py-2 disabled:opacity-50">
                <ArrowRight className="size-3.5" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
