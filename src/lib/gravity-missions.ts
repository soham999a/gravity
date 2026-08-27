"use client";

import * as React from "react";

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

function loadFromStorage(): MissionRow[] | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    cached = Array.isArray(parsed) ? (parsed as MissionRow[]) : null;
    return cached;
  } catch {
    return null;
  }
}

function persist(rows: MissionRow[]) {
  cached = rows;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {
    /* storage unavailable */
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
    let api: MissionRow[] = [];
    let ok = false;
    try {
      const res = await fetch("/api/missions", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { missions?: MissionRow[]; live?: boolean };
        api = json.missions ?? [];
        ok = true;
        setLive(Boolean(json.live));
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
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (!cancelled) void refresh();
    }, POLL_MS);
    const raf = requestAnimationFrame(() => {
      if (!cancelled) void refresh();
    });
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