"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight, FileText } from "lucide-react";
import { TaskComposer } from "@/components/studio/TaskComposer";
import type { CsvFile } from "@/components/studio/TaskComposer";
import { MissionRun } from "@/components/studio/MissionRun";
import { RightSideVisualField } from "@/components/gravity/RightSideVisualField";

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
  createdAt: string;
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
  const [missionId, setMissionId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [prefill, setPrefill] = React.useState("");
  const [recent, setRecent] = React.useState<MissionRow[]>([]);
  const runRef = React.useRef<HTMLDivElement>(null);
  const composerRef = React.useRef<HTMLDivElement>(null);

  const loadRecent = React.useCallback(async () => {
    try {
      const res = await fetch("/api/missions", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { missions?: MissionRow[] };
      setRecent(json.missions?.slice(0, 3) ?? []);
    } catch {
      /* engine offline */
    }
  }, []);

  React.useEffect(() => {
    loadRecent();
  }, [loadRecent]);

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
    // Seed the follow-up with the original task so the engine keeps context.
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
    setPrefill(prompt === "" ? `example-${Date.now()}` : prompt);
    setSubmitError(null);
    if (prompt === "") {
      setPrefill("");
    }
    setMissionId(null);
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <div className="studio-page studio-home">
      <section className="studio-hero">
        <div className="studio-hero-grid">
          <div className="relative z-10 max-w-4xl">
            <p className="studio-eyebrow">01 / GRAVITY STUDIO</p>
            <h1 className="studio-hero-title mt-5">
              Create anything.
              <br />
              <span>Let intelligence handle the complexity.</span>
            </h1>
            <p className="studio-hero-copy">
              From a simple request to the right combination of models, algorithms, agents, and
              tools.
            </p>
            <div ref={composerRef} className="mt-10 max-w-4xl">
              <TaskComposer key={prefill || "fresh"} initialValue={prefill} busy={busy} onSubmit={submit} />
            </div>
            {submitError ? (
              <p className="mt-3 border border-danger/30 bg-danger/5 px-4 py-2 text-xs text-[color:var(--color-danger-text)]">
                {submitError}
              </p>
            ) : null}
            <div className="mt-4 flex items-center gap-3">
              <span className="status-dot" />
              <span className="studio-meta">
                Start with an intent. GRAVITY decides what kind of intelligence belongs behind it.
              </span>
            </div>
          </div>
          <RightSideVisualField />
        </div>
      </section>

      <div ref={runRef}>
        {missionId ? (
          <MissionRun
            missionId={missionId}
            onFollowUp={handleFollowUp}
            onRetry={handleRetry}
          />
        ) : null}
      </div>

      <section className="studio-section studio-contrast-band studio-bone-band">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="studio-eyebrow">02 / EXPLORE</p>
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
            <p className="studio-eyebrow">03 / RECENT PROJECTS</p>
            <h2 className="studio-section-title mt-3">Keep the thread.</h2>
          </div>
          <Link href="/projects" className="studio-text-link">
            View all projects <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {recent.length > 0 ? (
          <div className="mt-8 grid gap-3 lg:grid-cols-3">
            {recent.map((item) => (
              <Link key={item.id} href={`/projects/${item.id}`} className="studio-recent-card">
                <div className="studio-recent-icon">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="studio-eyebrow">
                    {item.status.toUpperCase()} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--color-ivory-dim)]">
                    {item.prompt}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 opacity-60" />
              </Link>
            ))}
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

export default function StudioHomePage() {
  return (
    <Suspense fallback={<div className="studio-page" />}>
      <HomeContent />
    </Suspense>
  );
}
