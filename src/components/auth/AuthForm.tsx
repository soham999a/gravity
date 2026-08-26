"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function AuthForm({ mode = "login" }: { mode?: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [success, setSuccess] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      let userCredential;

      if (mode === "signup") {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      // Get the ID token and set it as a cookie for middleware
      const idToken = await userCredential.user.getIdToken();
      document.cookie = `fb-token=${idToken}; path=/; max-age=3600; SameSite=Lax`;

      if (mode === "signup") {
        setSuccess("Account created! Redirecting…");
      }

      router.replace(next);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found") setError("No account found with this email.");
      else if (code === "auth/wrong-password" || code === "auth/invalid-credential") setError("Invalid email or password.");
      else if (code === "auth/email-already-in-use") setError("An account with this email already exists.");
      else if (code === "auth/weak-password") setError("Password must be at least 6 characters.");
      else if (code === "auth/invalid-email") setError("Invalid email address.");
      else setError(String(err).slice(0, 200));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-serif text-3xl text-[var(--color-ivory)]" style={{ fontFamily: "var(--font-serif)" }}>
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
        {mode === "login"
          ? "Sign in to access GRAVITY Studio."
          : "Get started with GRAVITY — free tier included."}
      </p>

      {error ? (
        <div className="mt-5 rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-5 rounded border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-300">
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-[0.17em] text-[var(--color-muted-foreground)]" style={{ fontFamily: "var(--font-mono)" }}>
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-sm text-[var(--color-ivory)] outline-none transition focus:border-[var(--color-gold)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-[0.17em] text-[var(--color-muted-foreground)]" style={{ fontFamily: "var(--font-mono)" }}>
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-sm text-[var(--color-ivory)] outline-none transition focus:border-[var(--color-gold)]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 border border-[var(--color-gold)] bg-transparent px-4 py-2.5 text-[10px] uppercase tracking-[0.17em] text-[var(--color-gold)] transition hover:bg-[var(--color-gold)] hover:text-[var(--color-void)] disabled:opacity-40"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-[var(--color-muted-foreground)]">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-[var(--color-gold)] underline underline-offset-2">
              Sign up
            </a>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <a href="/login" className="text-[var(--color-gold)] underline underline-offset-2">
              Sign in
            </a>
          </>
        )}
      </p>
    </div>
  );
}
