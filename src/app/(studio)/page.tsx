"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Gauge,
  Layers,
  Timer,
  Zap,
} from "lucide-react";
import { TaskComposer } from "@/components/studio/TaskComposer";
import type { CsvFile } from "@/components/studio/TaskComposer";
import { MissionRun } from "@/components/studio/MissionRun";
import { RightSideVisualField } from "@/components/gravity/RightSideVisualField";
import { useGravityUser } from "@/lib/gravity-user";
import { num } from "@/lib/utils";

const FREE_LIMIT = 250_000;

const CATEGORIES = [
  {
    label: "ANALYZE",
    description: "Find the signal in what you already have.",
    example:
      "Analyse our quarterly sales decline of 12% and recommend a data-driven recovery strategy.",
  },
  {
    label: "DECIDE",
    description: "Turn a hard choice into a reasoned recommendation.",
    example:
      "We must choose between building our own fraud-detection system or buying one. Compare cost, risk, and time-to-market.",
  },
  {
    label: "RESEARCH",
    description: "Explore a question with the right depth.",
    example:
      "Give me a briefing on the competitive landscape for AI orchestration platforms in 2026.",
  },
  {
    label: "CREATE",
    description: "Make something from a blank page.",
    example:
      "Write a launch announcement for GRAVITY Studio aimed at operations leaders.",
  },
  {
    label: "PLAN",
    description: "Break ambition into an executable sequence.",
    example:
      "Design a 90-day plan to migrate our monolith to a distributed architecture with minimal downtime.",
  },
  {
    label: "MEASURE",
    description: "Let computation speak before models do.",
    example:
      "Here are monthly demand figures: 1200, 1350, 1290, 1480, 1520, 1495, 1610. Summarise trend, drift and volatility.",
  },
];

interface MissionRow {
  id: string;
  prompt: string;
  status: string;
  totalTokens: number | null;
  totalLatencyMs: number | null;
  createdAt: string;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

async function startMission(prompt: string, files?: CsvFile[]): Promise<string> {
  const res = await fetch("/api/missions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, files }),
  });
  if (!res.ok) throw new Error(`Status ${res.status}`);
  const json = (await res.json()) as { missionId: string };
  fetch(`/api/missions/${json.missionId}/execute`, { method: "POST" }).catch(() => {});
  return json.missionId;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const userName = useGravityUser((state) => state.name);
  const hydrate = useGravityUser((state) => state.hydrate);
  const [missionId, setMissionId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [prefill, setPrefill] = React.useState("");
  const [focusComposer, setFocusComposer] = React.useState(false);
  const [recent, setRecent] = React.useState<MissionRow[]>([]);
  const [stats, setStats] = React.useState<{
    total: number;
    completed: number;
    tokensMonth: number;
    tokensAll: number;
  } | null>(null);
  const runRef = React.useRef<HTMLDivElement>(null);
  const composerRef = React.useRef<HTMLDivElement>(null);
  const remountRef = React.useRef(0);

  const loadDashboard = React.useCallback(async () => {
    try {
      const res = await fetch("/api/missions", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { missions?: MissionRow[] };
      const missions = json.missions ?? [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const completed = missions.filter((m) => m.status === "completed");
      const tokensMonth = missions
        .filter((m) => new Date(m.createdAt).getTime() >= monthStart)
        .reduce((sum, m) => sum + (m.totalTokens ?? 0), 0);
      const tokensAll = missions.reduce((sum, m) => sum + (m.totalTokens ?? 0), 0);
      setStats({ total: missions.length, completed: completed.length, tokensMonth, tokensAll });
      setRecent(
        [...missions]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 4),
      );
    } catch {
      /* engine offline */
    }
  }, []);

  React.useEffect(() => {
    hydrate();
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard, hydrate]);

  React.useEffect(() => {
    if (searchParams.get("compose") === "1") {
      requestAnimationFrame(() => {
        composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (runRef.current && missionId) {
      runRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [missionId]);

  const submit = async (prompt: string, files?: CsvFile[]) => {
    setBusy(true);
    setSubmitError(null);
    setMissionId(null);
    try {
      const id = await startMission(prompt, files);
      setMissionId(id);
    } catch {
      setSubmitError(
        "GRAVITY could not start the task. Check your connection and try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleFollowUp = async (refinement: string) => {
    if (!missionId) return;
    let original = "";
    try {
      const res = await fetch(`/api/missions/${missionId}`, { cache: "no-store" });
      if (res.ok) original = ((await res.json()) as { mission: { prompt: string } }).mission.prompt;
    } catch {
      /* fall back to refinement only */
    }
    const prompt = original
      ? `${original}\n\nFollow-up instruction: ${refinement}`
      : `${refinement} (Follow-up to my previous GRAVITY task.)`;
    const id = await startMission(prompt);
    setMissionId(id);
  };

  const handleRetry = async () => {
    if (!missionId) return;
    await fetch(`/api/missions/${missionId}/execute`, { method: "POST" }).catch(() => {});
  };

  const pickExample = (prompt: string) => {
    const remount = prompt === "" ? `example-${(remountRef.current += 1)}` : prompt;
    setPrefill(remount);
    setSubmitError(null);
    setFocusComposer(true);
    setMissionId(null);
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const displayName = (userName || "").trim() || "creator";
  const usagePct = stats ? Math.min(100, (stats.tokensMonth / FREE_LIMIT) * 100) : 0;

  return (
    <div className="studio-page studio-home">
      <section className="studio-dash-hero">
        <div className="relative z-10">
          <p className="studio-eyebrow">STUDIO OVERVIEW</p>
          <h1 className="studio-hero-title mt-4">
            {greeting()}, <span className="studio-greet-name">{displayName}.</span>
          </h1>
          <p className="studio-hero-copy">
            State an intent. GRAVITY assembles the right intelligence behind it — the least complex
            sufficient path, made visible when you want it.
          </p>
        </div>
        <RightSideVisualField />
      </section>

      <div className="studio-dash-grid">
        <div className="studio-panel studio-panel-pad">
          <div className="flex items-center justify-between gap-3">
            <p className="studio-eyebrow">01 / NEW TASK</p>
            <span className="studio-meta">START WITH AN INTENT</span>
          </div>
          <div ref={composerRef} className="mt-5 scroll-mt-24">
            <TaskComposer
              key={prefill || "fresh"}
              initialValue={prefill}
              busy={busy}
              autoFocus={focusComposer}
              onSubmit={submit}
            />
          </div>
          {submitError ? (
            <p className="mt-3 border border-danger/30 bg-danger/5 px-4 py-2 text-xs text-[color:var(--color-danger-text)]">
              {submitError}
            </p>
          ) : null}
        </div>

        <div className="studio-panel studio-panel-fill studio-panel-pad">
          <div className="flex items-center justify-between gap-3">
            <p className="studio-eyebrow">02 / SNAPSHOT</p>
            <Link href="/settings" className="studio-text-link">
              View plan
            </Link>
          </div>
          <div className="studio-stat-grid mt-5">
            <StatCard
              label="TASKS RUN"
              icon={<Layers className="size-4" />}
              value={stats ? num(stats.total) : null}
              foot="LIFETIME"
            />
            <StatCard
              label="COMPLETED"
              icon={<CheckCircle2 className="size-4" />}
              value={stats ? num(stats.completed) : null}
              foot="DELIVERED TO YOU"
            />
            <StatCard
              label="SUCCESS RATE"
              icon={<Gauge className="size-4" />}
              value={stats && stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : stats ? "—" : null}
              foot="OF ALL RUNS"
              metric={stats && stats.total > 0 && stats.completed / stats.total >= 0.8 ? "ok" : undefined}
            />
            <StatCard
              label="TOKENS / MONTH"
              icon={<Timer className="size-4" />}
              value={stats ? num(stats.tokensMonth) : null}
              foot={`OF ${FREE_LIMIT.toLocaleString()} ALLOWED`}
              metric={stats && usagePct < 70 ? "ok" : "warn"}
            />
          </div>

          <div className="studio-usage mt-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="studio-meta">FREE PLAN · THIS MONTH</p>
              <p className="studio-meta">{Math.round(usagePct)}%</p>
            </div>
            <div className="studio-usage-meter">
              <div
                className={`studio-usage-fill ${usagePct < 70 ? "" : "studio-usage-fill-high"}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <div className="studio-usage-row">
              <span className="studio-meta">
                {stats ? `${num(stats.tokensMonth)} / ${num(FREE_LIMIT)}` : "—"}
              </span>
              <span className="studio-meta flex items-center gap-1.5">
                <Zap className="size-3 text-gold" />
                UPGRADE FOR 10× MORE
              </span>
            </div>
          </div>
        </div>
      </div>

      <div ref={runRef}>
        {missionId ? (
          <MissionRun missionId={missionId} onFollowUp={handleFollowUp} onRetry={handleRetry} />
        ) : null}
      </div>

      <section className="studio-section studio-contrast-band studio-bone-band">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="studio-eyebrow">03 / STARTING POINTS</p>
            <h2 className="studio-section-title mt-3">
              A task surface,
              <br />
              <span>not a toolbox.</span>
            </h2>
          </div>
          <p className="studio-muted max-w-xs">
            Choose a starting point, or describe the outcome in your own words. The route adapts.
          </p>
        </div>
        <div className="studio-category-grid mt-10">
          {CATEGORIES.map((category) => (
            <button
              key={category.label}
              type="button"
              onClick={() => pickExample(category.example)}
              className="studio-category-card group text-left"
            >
              <div className="flex items-start justify-between">
                <span className="studio-eyebrow">{category.label}</span>
                <ArrowUpRight className="size-4 opacity-60 transition group-hover:text-gold" />
              </div>
              <h3 className="mt-9 font-serif text-xl font-light">{category.description}</h3>
              <div className="mt-7">
                <span className="studio-example-chip">Try it →</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="studio-section-borderless mt-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="studio-eyebrow">04 / RECENT PROJECTS</p>
            <h2 className="studio-section-title mt-3">Keep the thread.</h2>
          </div>
          <Link href="/projects" className="studio-text-link">
            View all projects <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {stats === null ? (
          <div className="studio-list mt-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="studio-list-item">
                <span className="studio-skeleton studio-list-icon" />
                <div className="min-w-0 flex-1">
                  <p className="studio-skeleton h-3 w-3/4" />
                  <p className="studio-skeleton mt-2 h-2 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : recent.length > 0 ? (
          <div className="studio-list mt-8">
            {recent.map((item) => {
              const done = item.status === "completed";
              return (
                <Link key={item.id} href={`/projects/${item.id}`} className="studio-list-item">
                  <span className="studio-list-icon">
                    <FileText className="size-4" />
                  </span>
                  <div className="studio-list-body">
                    <p className="studio-list-title">{item.prompt}</p>
                    <p className="studio-list-meta">
                      {done ? "COMPLETE" : item.status.toUpperCase()} ·{" "}
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {new Date(item.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      {item.totalTokens ? ` · ${item.totalTokens.toLocaleString()} tokens` : ""}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 opacity-60" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="studio-empty mt-8">
            <FileText className="size-5 text-gold" />
            <h3 className="mt-4 font-serif text-xl">Nothing here yet.</h3>
            <p className="studio-muted mt-2 max-w-sm">
              Your finished tasks will collect here as projects you can revisit.
            </p>
          </div>
        )}
      </section>

      <section className="studio-quote-section studio-contrast-band studio-bone-band mt-20">
        <div className="studio-quote-mark">“</div>
        <div>
          <p className="studio-quote">
            Intelligence is allocated,
            <br />
            <em>not maximized.</em>
          </p>
          <p className="studio-muted mt-5">
            GRAVITY chooses the least complex sufficient path — and makes the reasoning visible when
            you want to see it.
          </p>
        </div>
        <button type="button" onClick={() => pickExample("")} className="studio-secondary-button shrink-0">
          Start creating <ArrowRight className="size-3.5" />
        </button>
      </section>
    </div>
  );
}

function StatCard({
  label,
  icon,
  value,
  foot,
  metric,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null;
  foot: string;
  metric?: "ok" | "warn";
}) {
  return (
    <div className="studio-stat-card">
      <div className="studio-stat-label">
        <span className="studio-eyebrow">{label}</span>
        <span className="studio-stat-icon">{icon}</span>
      </div>
      {value === null ? (
        <p className="studio-skeleton mt-4 h-8 w-16" />
      ) : (
        <p className="studio-stat-value">{value}</p>
      )}
      <p className={`studio-stat-foot ${metric ? `studio-stat-metric-${metric}` : ""}`}>{foot}</p>
    </div>
  );
}

export default function StudioHomePage() {
  return (
    <Suspense fallback={<div className="studio-page" />}>
      <HomeContent />
    </Suspense>
  );
}