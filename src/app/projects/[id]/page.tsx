"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { MissionRun } from "@/components/studio/MissionRun";
import { RightSideVisualField } from "@/components/gravity/RightSideVisualField";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [deleting, setDeleting] = React.useState(false);

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
      router.push("/projects");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="studio-page">
      <section className="studio-hero" style={{ paddingBottom: 0 }}>
        <div className="studio-hero-grid">
          <div className="relative z-10 max-w-4xl">
            <div className="flex items-center gap-4">
              <Link href="/projects" className="studio-back-link">
                <ArrowLeft className="size-4" /> Projects
              </Link>
              <button
                type="button"
                onClick={deleteMission}
                disabled={deleting}
                className="ml-auto studio-danger-link"
                title="Delete this project"
              >
                <Trash2 className="size-3.5" />
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
          <RightSideVisualField />
        </div>
      </section>
      <MissionRun missionId={id} onFollowUp={handleFollowUp} onRetry={handleRetry} />
    </div>
  );
}
