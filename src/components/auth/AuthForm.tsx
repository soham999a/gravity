"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Email confirmation enabled → no session yet.
        if (!data.session) {
          setNotice("Check your inbox to confirm your email, then sign in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const next = searchParams.get("next") ?? "/";
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-[380px]">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="font-mono text-[10px] tracking-[0.2em] text-gold">MATRIX</span>
          <span className="w-px h-4 bg-border" />
          <span className="font-serif text-sm text-ivory italic">GRAVITY</span>
        </div>
        <h1 className="font-serif text-3xl font-light text-ivory">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>
        <p className="kicker mt-2">
          {mode === "login"
            ? "Access your intelligence workspace"
            : "Provision a new GRAVITY workspace"}
        </p>
      </div>

      <label className="kicker mb-1.5 block">Email</label>
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="w-full bg-deep border border-border px-4 py-3 text-sm text-ivory placeholder:text-ivory-faint focus:outline-none focus:border-gold/40 mb-4"
      />

      <label className="kicker mb-1.5 block">Password</label>
      <input
        type="password"
        required
        minLength={8}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        className="w-full bg-deep border border-border px-4 py-3 text-sm text-ivory placeholder:text-ivory-faint focus:outline-none focus:border-gold/40 mb-6"
      />

      {error && (
        <p className="mb-4 border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger-text">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 border border-gold/30 bg-gold-pale px-3 py-2 text-xs text-gold">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !email || password.length < 8}
        className="w-full py-3 bg-gold text-void font-mono text-[10px] tracking-[0.18em] uppercase hover:bg-gold/90 disabled:opacity-40 transition-colors"
      >
        {busy ? "Working…" : mode === "login" ? "Sign In" : "Create Workspace"}
      </button>

      <div className="mt-6 text-center">
        <Link
          href={mode === "login" ? "/signup" : "/login"}
          className="font-mono text-[9px] tracking-[0.12em] uppercase text-ivory-faint hover:text-gold transition-colors"
        >
          {mode === "login"
            ? "No account? Create one →"
            : "Already have an account? Sign in →"}
        </Link>
      </div>
    </form>
  );
}

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  return (
    <main className="min-h-screen grid-bg flex items-center justify-center p-6">
      <AuthFormWrapper mode={mode} />
    </main>
  );
}

function AuthFormWrapper({ mode }: { mode: "login" | "signup" }) {
  return (
    <React.Suspense fallback={null}>
      <AuthForm mode={mode} />
    </React.Suspense>
  );
}
