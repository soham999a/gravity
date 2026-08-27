"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { MissionRun } from "@/components/studio/MissionRun";
import { RightSideVisualField } from "@/components/gravity/RightSideVisualField";
import { useGravityUser } from "@/lib/gravity-user";
import { toast } from "@/components/studio/toast";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirmDelete = useGravityUser((state) => state.confirmDelete);
  const [deleting, setDeleting] = React.useState(false);
  const [prompt, setPrompt] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/missions/${id}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { mission?: { prompt: string } } | null) => {
        if (!cancelled && json?.mission?.prompt) setPrompt(json.mission.prompt);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleFollowUp = async (refinement: string) => {
    let original = "";
    try {
      const res = await fetch(`/api/missions/${id}`, { cache: "no-store" });
      if (res.ok) original = ((await res.json()) as { mission: { prompt: string } }).mission.prompt;
    } catch {
      /* use refinement only */
    }
    const prompt = original
      ? `${original}\n\nFollow-up instruction: ${refinement}`
      : refinement;
    const createRes = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!createRes.ok) throw new Error("Failed to start follow-up");
    const { missionId } = (await createRes.json()) as { missionId: string };
    fetch(`/api/missions/${missionId}/execute`, { method: "POST" }).catch(() => {});
    router.push(`/projects/${missionId}`);
  };

  const handleRetry = async () => {
    await fetch(`/api/missions/${id}/execute`, { method: "POST" }).catch(() => {});
    // Force a remount so MissionRun re-fetches
    router.refresh();
  };

  const deleteMission = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch(`/api/missions/${id}`, { method: "DELETE" });
      toast("Project deleted", "It's gone from your archive.", "success");
      router.push("/projects");
    } finally {
      setDeleting(false);
    }
  };

  const requestDelete = () => {
    if (confirmDelete) {
      setConfirmOpen(true);
    } else {
      deleteMission();
    }
  };

  return (
    <div className="studio-page">
      <section className="studio-hero studio-page-hero-compact" style={{ paddingBottom: 0 }}>
        <div className="studio-hero-grid">
          <div className="relative z-10 max-w-4xl">
            <div className="flex items-center gap-4">
              <Link href="/projects" className="studio-back-link">
                <ArrowLeft className="size-4" /> Projects
              </Link>
              <button
                type="button"
                onClick={requestDelete}
                disabled={deleting}
                className="ml-auto studio-danger-link"
                title="Delete this project"
              >
                <Trash2 className="size-3.5" />
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
            <p className="studio-eyebrow mt-8">PROJECT</p>
            <h1 className="studio-hero-title mt-3">
              {prompt ? (
                <span className="line-clamp-3">{prompt}</span>
              ) : (
                <span>Project</span>
              )}
            </h1>
          </div>
          <RightSideVisualField />
        </div>
      </section>
      <MissionRun missionId={id} onFollowUp={handleFollowUp} onRetry={handleRetry} />

      {confirmOpen ? (
        <div className="studio-dialog-overlay" role="dialog" aria-modal="true" aria-label="Delete project">
          <div className="studio-dialog">
            <p className="studio-dialog-kicker">IRREVERSIBLE ACTION</p>
            <h3 className="studio-dialog-title">Delete this project?</h3>
            <p className="studio-dialog-copy">
              The result, reasoning, and receipts for this task will be permanently removed. This
              cannot be undone.
            </p>
            <div className="studio-dialog-actions">
              <button type="button" onClick={() => setConfirmOpen(false)} className="studio-secondary-button">
                Keep project
              </button>
              <button
                type="button"
                onClick={deleteMission}
                disabled={deleting}
                className="studio-danger-button"
              >
                <Trash2 className="size-3.5" />
                {deleting ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
