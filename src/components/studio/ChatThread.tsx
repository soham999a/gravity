"use client";

import * as React from "react";
import { ArrowRight, LoaderCircle, Plus, RotateCcw, Square, Trash2, Wand2 } from "lucide-react";
import { Markdown } from "./Markdown";
import { useChatThreads } from "@/lib/chatThreads";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length, chat.phase]);

  const submit = (text: string) => {
    if (!authed) {
      onRequireAuth();
      return;
    }
    setDraft("");
    void chat.send(text);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      {/* ── Sidebar ── */}
      <aside className="rounded-lg border border-border bg-surface p-3">
        <button
          type="button"
          onClick={() => chat.newThread()}
          className="studio-secondary-button w-full"
        >
          <Plus className="size-3.5" /> New chat
        </button>
        <div className="mt-3 space-y-1">
          {chat.threads.length === 0 ? (
            <p className="meta px-1 py-2">No chats yet — start one.</p>
          ) : (
            chat.threads.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5",
                  t.id === chat.activeId ? "bg-gold-pale" : "hover:bg-surface",
                )}
              >
                <button
                  type="button"
                  onClick={() => chat.setActiveId(t.id)}
                  className="min-w-0 flex-1 text-left"
                  title={t.title}
                >
                  <span className="block truncate text-sm text-ivory">{t.title}</span>
                  <span className="meta">{timeAgo(t.createdAt)} · {t.messages.length / 2 === 0 ? 0 : Math.ceil(t.messages.length / 2)} turns</span>
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
            ))
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
            <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
              {active.messages.length === 0 ? (
                <p className="meta py-6 text-center">First message sets the title. History ships as real turns.</p>
              ) : (
                active.messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-lg bg-gold-pale px-3 py-2 text-sm text-ivory">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="rounded-lg border border-border-light px-3 py-2">
                      {m.content ? (
                        <Markdown>{m.content}</Markdown>
                      ) : (
                        <span className="meta flex items-center gap-2">
                          <LoaderCircle className="size-3.5 animate-spin" /> thinking…
                        </span>
                      )}
                      {m.model || m.ms ? (
                        <p className="meta mt-1.5">
                          {m.model ? m.model.split("/").pop() : ""}{m.model && m.ms ? " · " : ""}{m.ms ? `${(m.ms / 1000).toFixed(1)}s` : ""}
                        </p>
                      ) : null}
                    </div>
                  ),
                )
              )}
              <div ref={bottomRef} />
            </div>

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

            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) submit(draft);
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && chat.phase === "streaming") chat.stop();
                }}
                placeholder={active.messages.length === 0 ? "Ask anything…" : "Refine in this thread…"}
                className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ivory"
                disabled={chat.phase === "streaming"}
              />
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
