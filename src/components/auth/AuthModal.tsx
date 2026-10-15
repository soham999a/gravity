"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, signInWithGoogle, googleErrorMessage } from "@/lib/firebase";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "@/components/studio/toast";

/** Official Google "G" mark — crisp on every platform (no emoji). */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.8 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.2-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.8 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.2-3.9z" />
    </svg>
  );
}

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
  const [googleBusy, setGoogleBusy] = React.useState(false);
  const emailRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus the fastest path first: email sits below Google, so focus it only
  // when the user tabs past — Google stays the one-tap hero.
  React.useEffect(() => {
    if (open) {
      setError(null);
      const t = window.setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 250);
      return () => window.clearTimeout(t);
    }
  }, [open, mode]);

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

  const handleGoogle = async () => {
    if (googleBusy || busy) return;
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      toast("Signed in with Google", "Running your task now.", "success");
      onSuccess();
      router.refresh();
    } catch (err: unknown) {
      setError(googleErrorMessage(err));
    } finally {
      setGoogleBusy(false);
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

        <p className="auth-modal-brand">
          <span className="auth-modal-brand-dot" /> GRAVITY
        </p>
        <p className="studio-eyebrow">{mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}</p>
        <h2 className="auth-modal-title">
          {mode === "signup" ? "One quick account." : "You're one step away."}
        </h2>
        <p className="auth-modal-reason">
          {reason ?? "Sign in and GRAVITY runs the task you just wrote — nothing is lost."}
        </p>

        <button
          type="button"
          className="auth-modal-submit auth-modal-google"
          disabled={busy || googleBusy}
          onClick={handleGoogle}
        >
          {googleBusy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <GoogleMark />
          )}
          <span>{googleBusy ? "Connecting…" : "Continue with Google"}</span>
        </button>

        <div className="auth-modal-divider" aria-hidden="true">
          <span>OR CONTINUE WITH EMAIL</span>
        </div>

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          <label className="studio-label" htmlFor="auth-modal-email">
            EMAIL
          </label>
          <input
            id="auth-modal-email"
            ref={emailRef}
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
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
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
