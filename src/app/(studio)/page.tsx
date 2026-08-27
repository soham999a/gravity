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
import { useMissionFeed } from "@/lib/gravity-missions";
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
  const { missions, loading, updateLocalStatus } = useMissionFeed();
  const [missionId, setMissionId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<{ id: string; prompt: string }[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [prefill, setPrefill] = React.useState("");
  const [focusComposer, setFocusComposer] = React.useState(false);
  const runRef = React.useRef<HTMLDivElement>(null);
  const composerRef = React.useRef<HTMLDivElement>(null);
  const remountRef = React.useRef(0);

  const stats = React.useMemo(() => {
    if (loading) return null;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const completed = missions.filter((m) => m.status === "completed");
    const tokensMonth = missions
      .filter((m) => new Date(m.createdAt).getTime() >= monthStart)
      .reduce((sum, m) => sum + (m.totalTokens ?? 0), 0);
    const tokensAll = missions.reduce((sum, m) => sum + (m.totalTokens ?? 0), 0);
    return {
      total: missions.length,
      completed: completed.length,
      tokensMonth,
      tokensAll,
    };
  }, [missions, loading]);

  const recent = React.useMemo(
    () => [...missions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4),
    [missions],
  );

  const timeline = React.useMemo(
    () => [...missions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6),
    [missions],
  );

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

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
      setThread((prev) => [...prev, { id, prompt }]);
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
              count={stats ? stats.total : undefined}
              foot="LIFETIME"
            />
            <StatCard
              label="COMPLETED"
              icon={<CheckCircle2 className="size-4" />}
              value={stats ? num(stats.completed) : null}
              count={stats ? stats.completed : undefined}
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
              count={stats ? stats.tokensMonth : undefined}
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
        {thread.length > 0 ? (
          <section className="studio-thread mt-16">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="studio-eyebrow">LIVE THREAD</p>
              <span className="studio-meta">
                {thread.length} TURN{thread.length > 1 ? "S" : ""} THIS SESSION
              </span>
            </div>
            <div className="studio-thread-list mt-4">
              {thread.map((turn, index) => {
                const latest = index === thread.length - 1;
                const active = turn.id === missionId;
                return (
                  <button
                    key={turn.id}
                    type="button"
                    onClick={() => setMissionId(turn.id)}
                    className={`studio-thread-item ${active ? "studio-thread-item-active" : ""}`}
                  >
                    <span className="studio-thread-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1 truncate text-left text-sm text-[color:var(--color-ivory-dim)]">
                      {turn.prompt}
                    </span>
                    {latest ? <span className="studio-example-chip !border-gold/40 !text-gold">LATEST</span> : null}
                    {active ? (
                      <span className="studio-meta">VIEWING</span>
                    ) : (
                      <ArrowRight className="size-3.5 shrink-0 text-[color:var(--color-muted-foreground)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
        {missionId ? (
          <div className={thread.length > 1 ? "mt-6" : "mt-0"}>
            <MissionRun
              missionId={missionId}
              onFollowUp={handleFollowUp}
              onRetry={handleRetry}
              onStatus={(status) => updateLocalStatus(missionId, status)}
            />
          </div>
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

      <section className="studio-section-borderless mt-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="studio-eyebrow">05 / ACTIVITY</p>
            <h2 className="studio-section-title mt-3">The visible trail.</h2>
          </div>
          <p className="studio-muted max-w-xs">
            Every run leaves receipts — saved so you can revisit the how as easily as the what.
          </p>
        </div>

        {timeline.length > 0 ? (
          <ol className="studio-timeline mt-9">
            {timeline.map((item) => {
              const done = item.status === "completed";
              const failed = item.status === "failed";
              return (
                <li key={item.id}>
                  <Link href={`/projects/${item.id}`} className="studio-timeline-row group">
                    <span
                      className={`studio-timeline-dot ${
                        failed
                          ? "studio-timeline-dot-failed"
                          : !done
                            ? "studio-timeline-dot-live"
                            : ""
                      }`}
                    />
                    <span className="studio-timeline-body">
                      <p className="studio-timeline-prompt">{item.prompt}</p>
                      <p className="studio-timeline-meta">
                        {done ? "COMPLETE" : failed ? "FAILED" : item.status.toUpperCase()}
                        {item.selectedStrategy ? ` · ${item.selectedStrategy.replaceAll("_", " ")}` : ""}
                      </p>
                    </span>
                    <span className="studio-timeline-time">
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="studio-muted mt-8">Nothing has run yet. Your activity will appear here.</p>
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

      {stats && usagePct > 70 ? (
        <div className="studio-nudge-pill">
          <Zap className="size-3.5 text-gold" />
          <span>
            You&apos;ve used <strong>{Math.round(usagePct)}%</strong> of this month&apos;s free tokens.
          </span>
          <Link href="/settings" className="studio-nudge-link">
            Upgrade <ArrowRight className="size-3" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = React.useState(0);
  const fromRef = React.useRef(0);
  React.useEffect(() => {
    const duration = 700;
    const start = performance.now();
    const from = fromRef.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = Math.round(from + (value - from) * eased);
      fromRef.current = current;
      setDisplay(current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

function StatCard({
  label,
  icon,
  value,
  count,
  foot,
  metric,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null;
  count?: number;
  foot: string;
  metric?: "ok" | "warn";
}) {
  const animate = count !== undefined && value !== null;
  return (
    <div className="studio-stat-card">
      <div className="studio-stat-label">
        <span className="studio-eyebrow">{label}</span>
        <span className="studio-stat-icon">{icon}</span>
      </div>
      {value === null ? (
        <p className="studio-skeleton mt-4 h-8 w-16" />
      ) : (
        <p className="studio-stat-value">
          {animate ? <CountUp value={count!} /> : value}
        </p>
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