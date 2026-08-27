"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

interface MissionRow {
  id: string;
  prompt: string;
  status: string;
  selectedStrategy: string | null;
  totalTokens: number | null;
  createdAt: string;
}

export default function ProjectsPage() {
  const [missions, setMissions] = React.useState<MissionRow[] | null>(null);

  React.useEffect(() => {
    fetch("/api/missions", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { missions?: MissionRow[] } | null) =>
        setMissions(json?.missions ?? []),
      )
      .catch(() => setMissions([]));
  }, []);

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

      <div className="mt-12">
        {missions === null ? (
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
        ) : missions.length === 0 ? (
          <div className="studio-empty">
            <FileText className="size-5 text-gold" />
            <h3 className="mt-4 font-serif text-xl">No projects yet.</h3>
            <p className="studio-muted mt-2 max-w-sm">
              Run your first task from the home surface and it will appear here.
            </p>
            <Link href="/" className="studio-secondary-button mt-6">
              Start creating <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-px border border-border md:grid-cols-2 xl:grid-cols-3">
            {missions.map((mission, index) => {
              const done = mission.status === "completed";
              const failed = mission.status === "failed";
              return (
                <Link
                  key={mission.id}
                  href={`/projects/${mission.id}`}
                  className="studio-category-card group flex flex-col"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-[10px] text-gold">
                      {String(index + 1).padStart(2, "0")}
                    </span>
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
