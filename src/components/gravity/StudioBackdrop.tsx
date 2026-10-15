"use client";

import * as React from "react";

/**
 * StudioBackdrop — light for the original studio home.
 *
 * Two layers, both behind everything (swarm stays exactly as-is):
 *  1. Optional abstract video: drop `studio-bg.mp4` (+ `studio-bg.jpg`
 *     poster) into public/ and it fades in, dimmed for readability.
 *     Missing file = element hides itself, zero breakage.
 *  2. Living aurora: two slow-drifting gold/ivory washes (pure CSS),
 *     so the page glows even with no video file.
 * Motion-safe: no video + no drift under prefers-reduced-motion;
 * video stays off on small screens (bandwidth).
 */
export function StudioBackdrop() {
  // Mount-gated: server and first client paint agree (no video), the video
  // mounts only after hydration — never a mismatch.
  const [mounted, setMounted] = React.useState(false);
  const [videoOK, setVideoOK] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const motionOK =
    mounted &&
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <>
      {motionOK && videoOK ? (
        <video
          className="studio-backdrop-video"
          src="/studio-bg.mp4"
          poster="/studio-bg.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onError={() => setVideoOK(false)}
          onCanPlay={(e) => {
            e.currentTarget.classList.add("studio-backdrop-video-on");
          }}
        />
      ) : null}
      <div className="studio-aurora" aria-hidden="true">
        <span className="studio-aurora-a" />
        <span className="studio-aurora-b" />
      </div>
    </>
  );
}
