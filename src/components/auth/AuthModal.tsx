"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { X } from "lucide-react";
import { toast } from "@/components/studio/toast";

/**
 * ChatGPT-style gate: the visitor typed a prompt on the public homepage;
 * this popup signs them in (or signs them up) and hands control back so
 * the homepage can run the prompt they already wrote.
 */
export function AuthModal({
  open,
  onClose,
  onSuccess,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reason?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const credential =
        mode === "signup"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      document.cookie = `fb-token=${idToken}; path=/; max-age=3600; SameSite=Lax`;
      toast(
        mode === "signup" ? "Account created" : "Signed in",
        "Running your task now.",
        "success",
      );
      onSuccess();
      router.refresh();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found") setError("No account found with this email.");
      else if (code === "auth/wrong-password" || code === "auth/invalid-credential")
        setError("Invalid email or password.");
      else if (code === "auth/email-already-in-use")
        setError("An account with this email already exists — switch to sign in.");
      else if (code === "auth/weak-password") setError("Password must be at least 6 characters.");
      else if (code === "auth/invalid-email") setError("Invalid email address.");
      else setError(String(err).slice(0, 200));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="auth-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Sign in to run your task">
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close sign in">
          <X className="size-4" />
        </button>

        <p className="studio-eyebrow">{mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}</p>
        <h2 className="auth-modal-title">
          {mode === "signup" ? "One quick account." : "You're one step away."}
        </h2>
        <p className="auth-modal-reason">
          {reason ?? "Sign in and GRAVITY runs the task you just wrote — nothing is lost."}
        </p>

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          <label className="studio-label" htmlFor="auth-modal-email">
            EMAIL
          </label>
          <input
            id="auth-modal-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
          />

          <label className="studio-label" htmlFor="auth-modal-password">
            PASSWORD
          </label>
          <div className="auth-modal-password">
            <input
              id="auth-modal-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>

          {error ? <p className="auth-modal-error">{error}</p> : null}

          <button type="submit" className="auth-modal-submit" disabled={busy}>
            <span>{busy ? "Working…" : mode === "signup" ? "Create & run my task" : "Sign in & run my task"}</span>
          </button>
        </form>

        <p className="auth-modal-switch">
          {mode === "signup" ? "Already have an account?" : "New to GRAVITY?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError(null);
            }}
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}
