"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MissionRun } from "@/components/studio/MissionRun";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <div className="studio-page">
      <div className="flex items-center gap-3">
        <Link href="/projects" className="studio-text-link">
          ← Projects
        </Link>
      </div>
      <p className="studio-eyebrow mt-6">PROJECT · {id.slice(0, 8).toUpperCase()}</p>
      <h1 className="mt-2 font-serif text-[clamp(30px,4vw,48px)] leading-tight text-ivory">
        The work, the reasoning, and the result.
      </h1>
      {id ? (
        <div className="mt-8">
          <MissionRun missionId={id} />
        </div>
      ) : null}
    </div>
  );
}
