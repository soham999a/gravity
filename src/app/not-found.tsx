import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: 48, maxWidth: 640, margin: "0 auto" }}>
      <p style={{ fontSize: 12, letterSpacing: 2, opacity: 0.6 }}>404 — NOT FOUND</p>
      <h1 style={{ fontSize: 32, margin: "12px 0" }}>This page doesn&apos;t exist.</h1>
      <Link href="/" style={{ textDecoration: "underline" }}>
        Go home
      </Link>
    </main>
  );
}
