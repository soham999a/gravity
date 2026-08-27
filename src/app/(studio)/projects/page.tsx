"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Pin, Search } from "lucide-react";
import { useMissionFeed } from "@/lib/gravity-missions";

function getPins(): string[] {
  try {
    const raw = localStorage.getItem("gravity.pins.v1");
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function savePins(pins: string[]) {
  try {
    localStorage.setItem("gravity.pins.v1", JSON.stringify(pins));
  } catch {
    /* storage unavailable */
  }
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Complete" },
  { key: "running", label: "In progress" },
  { key: "failed", label: "Failed" },
];

export default function ProjectsPage() {
  const { missions, loading } = useMissionFeed();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [sort, setSort] = React.useState<"newest" | "oldest">("newest");
  const [pins, setPins] = React.useState<string[]>([]);

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setPins(getPins()));
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setPins((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev.slice(0, 5)];
      savePins(next);
      return next;
    });
  };

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (loading) return null;
    let list = [...missions];
    if (q) list = list.filter((m) => m.prompt.toLowerCase().includes(q));
    if (status === "running") {
      list = list.filter((m) => !["completed", "failed"].includes(m.status));
    } else if (status !== "all") {
      list = list.filter((m) => m.status === status);
    }
    list.sort((a, b) =>
      sort === "newest"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    if (pins.length > 0 && sort === "newest") {
      list.sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)));
    }
    return list;
  }, [missions, loading, q, status, sort, pins]);

  const count = (key: string) => {
    if (loading || missions.length === 0) return 0;
    if (key === "all") return missions.length;
    if (key === "running")
      return missions.filter((m) => !["completed", "failed"].includes(m.status)).length;
    return missions.filter((m) => m.status === key).length;
  };

  return (
    <div className="studio-page">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="studio-eyebrow">PROJECTS</p>
          <h1 className="studio-page-title mt-3">Keep the thread.</h1>
        </div>
        <p className="studio-muted max-w-xs">
          Every task you run becomes a project — result, reasoning, and receipts preserved.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="studio-search relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--color-muted-foreground)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects"
            className="studio-search-input"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="studio-segmented" role="group" aria-label="Status filter">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatus(f.key)}
                className={`studio-segmented-item ${status === f.key ? "studio-segmented-item-active" : ""}`}
              >
                {f.label}
                {count(f.key) > 0 ? <span className="studio-segmented-count">{count(f.key)}</span> : null}
              </button>
            ))}
          </div>
          <div className="studio-select-wrap">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
              aria-label="Sort projects"
              className="studio-select"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-8">
        {filtered === null ? (
          <div className="grid grid-cols-1 gap-px border border-border md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="studio-category-card flex flex-col">
                <p className="studio-skeleton h-3 w-8" />
                <p className="studio-skeleton mt-8 h-4 w-full" />
                <p className="studio-skeleton mt-3 h-4 w-2/3" />
                <div className="mt-auto pt-7">
                  <p className="studio-skeleton h-6 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="studio-empty">
            <Search className="size-5 text-gold" />
            <h3 className="mt-4 font-serif text-xl">
              {missions.length === 0 ? "No projects yet." : "No matches."}
            </h3>
            <p className="studio-muted mt-2 max-w-sm">
              {missions.length === 0
                ? "Run your first task from the home surface and it will appear here."
                : "Try a different search or clear the filters."}
            </p>
            <Link href="/" className="studio-secondary-button mt-6">
              Start creating <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-px border border-border md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((mission) => {
              const done = mission.status === "completed";
              const failed = mission.status === "failed";
              const pinned = pins.includes(mission.id);
              return (
                <Link
                  key={mission.id}
                  href={`/projects/${mission.id}`}
                  className="studio-category-card group flex flex-col"
                >
                  <div className="flex items-start justify-between">
                    <button
                      type="button"
                      onClick={(e) => togglePin(e, mission.id)}
                      aria-label={pinned ? "Unpin project" : "Pin project"}
                      aria-pressed={pinned}
                      title={pinned ? "Unpin" : "Pin"}
                      className={`studio-pin-button ${pinned ? "studio-pin-button-active" : ""}`}
                    >
                      <Pin className="size-3.5" />
                    </button>
                    <ArrowRight className="size-4 opacity-50 transition group-hover:text-gold group-hover:opacity-100" />
                  </div>
                  <p className="mt-8 line-clamp-4 font-serif text-lg leading-snug text-ivory">
                    {mission.prompt}
                  </p>
                  <div className="mt-auto pt-7">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`studio-example-chip ${
                          done
                            ? ""
                            : failed
                              ? "!border-danger/40 !text-[color:var(--color-danger-text)]"
                              : "!border-gold/40 !text-gold"
                        }`}
                      >
                        {done ? "COMPLETE" : failed ? "FAILED" : mission.status.toUpperCase()}
                      </span>
                      {mission.selectedStrategy ? (
                        <span className="studio-example-chip">
                          {mission.selectedStrategy.replaceAll("_", " ")}
                        </span>
                      ) : null}
                    </div>
                    <p className="studio-meta mt-4">
                      {new Date(mission.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {mission.totalTokens ? ` · ${mission.totalTokens.toLocaleString()} tokens` : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}