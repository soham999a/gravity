"use client";

import * as React from "react";
import { displayPrompt } from "./gravity/promptText";

export interface MissionRow {
  id: string;
  prompt: string;
  status: string;
  selectedStrategy: string | null;
  totalTokens: number | null;
  totalLatencyMs: number | null;
  createdAt: string;
}

const CACHE_KEY = "gravity.missions.v1";
const POLL_MS = 5000;
const MAX_CACHE = 200;

let cached: MissionRow[] | null = null;

/**
 * Do NOT hard-stop on 401 — the /api/missions route is auth-gated, so a
 * browser session that has expired (or is unauthenticated) still needs the
 * feed to keep polling. The dashboard degrades to "no session" instead of
 * freezing the whole screen at TASKS RUN 0/0. The live elapsed-time clock
 * in MissionRun.tsx keeps the run panel honest while the session is dead.
 * Reset by an explicit successful refresh (i.e. after signing in).
 */
let pollingStopped = false;

function loadFromStorage(): MissionRow[] | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    // Self-heal: caches written before sanitization embed whole uploaded
    // files and can blow past the origin quota (kQuotaBytes), which also
    // breaks Firebase's own storage. Drop oversized legacy caches.
    if (raw.length > 1_500_000) {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }
    const parsed = JSON.parse(raw);
    cached = Array.isArray(parsed) ? (parsed as MissionRow[]) : null;
    return cached;
  } catch {
    return null;
  }
}

/**
 * Prompts may embed whole uploaded files as [DATA:...] blocks. Caching them
 * raw grew the mission cache by megabytes per CSV upload and exhausted the
 * localStorage quota. The UI only ever renders displayPrompt() output, so
 * cache the display-safe (small) form instead.
 */
function sanitizeForCache(row: MissionRow): MissionRow {
  return { ...row, prompt: displayPrompt(row.prompt).slice(0, 300) };
}

function persist(rows: MissionRow[]) {
  cached = rows;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(rows.map(sanitizeForCache)));
  } catch {
    /* storage unavailable or quota exceeded — cache is best-effort */
  }
}

function byNewest(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * API rows are authoritative; cache rows fill the gaps (covers the
 * in-memory store being wiped on a local dev server restart).
 */
function mergeLists(api: MissionRow[], cache: MissionRow[] | null): MissionRow[] {
  const byId = new Map<string, MissionRow>();
  for (const row of api) byId.set(row.id, row);
  if (cache) {
    for (const row of cache) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort(byNewest).slice(0, MAX_CACHE);
}

export function useMissionFeed() {
  const [rows, setRows] = React.useState<MissionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [live, setLive] = React.useState<boolean | null>(null);

  const refresh = React.useCallback(async () => {
    if (pollingStopped) {
      setLoading(false);
      return true;
    }
    let api: MissionRow[] = [];
    let ok = false;
    let authError = false;
    try {
      const res = await fetch("/api/missions", { cache: "no-store", credentials: "include" });
      if (res.ok) {
        const json = (await res.json()) as { missions?: MissionRow[]; live?: boolean };
        api = json.missions ?? [];
        ok = true;
        pollingStopped = false;
        setLive(Boolean(json.live));
      } else if (res.status === 401) {
        // Unauthenticated — keep polling (the feed must not freeze the whole
        // screen at TASKS RUN 0/0). The MissionRun live clock shows the real
        // elapsed time while the session is dead.
        authError = true;
        setLive(false);
      }
    } catch {
      /* engine offline — fall through to cache */
      setLive(false);
    }
    if (ok) {
      const merged = mergeLists(api, loadFromStorage());
      persist(merged);
      setRows(merged);
    }
    setLoading(false);
    return authError;
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled || pollingStopped) return; // hard-stopped after 401
      await refresh();
    };

    const timer = window.setInterval(tick, POLL_MS);
    const raf = requestAnimationFrame(() => void tick());
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, [refresh]);

  const updateLocalStatus = React.useCallback((id: string, status: string) => {
    setRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (row.id === id && row.status !== status) {
          changed = true;
          return { ...row, status };
        }
        return row;
      });
      if (changed) persist(next);
      return next;
    });
  }, []);

  return { missions: rows, loading, live, refresh, updateLocalStatus };
}