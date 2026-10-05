"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: 48, maxWidth: 640, margin: "0 auto" }}>
      <p style={{ fontSize: 12, letterSpacing: 2, opacity: 0.6 }}>GRAVITY — SOMETHING FAILED</p>
      <h1 style={{ fontSize: 32, margin: "12px 0" }}>This page didn&apos;t load.</h1>
      <p style={{ opacity: 0.7 }}>{error.message?.slice(0, 300) || "Unexpected error."}</p>
      <button
        onClick={reset}
        style={{ marginTop: 20, padding: "10px 18px", border: "1px solid #333", cursor: "pointer" }}
      >
        Try again
      </button>
    </main>
  );
}
