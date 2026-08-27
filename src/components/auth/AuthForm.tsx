"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/studio/toast";

export function AuthForm({ mode = "login" }: { mode?: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
const isNewAccount = mode === "signup";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
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

      const idToken = await userCredential.user.getIdToken();
      document.cookie = `fb-token=${idToken}; path=/; max-age=3600; SameSite=Lax`;

if (mode === "signup") {
          setSuccess("Account created! Setting you up…");
          toast("Welcome to GRAVITY", "Let's set up your studio in a few seconds.", "success");
        } else {
          toast("Signed in", `Welcome back${email ? `, ${email.split("@")[0]}` : ""}.`);
        }

        router.replace(isNewAccount ? "/onboarding" : next);
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
    <div className="auth-container">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-mark">G</div>
          <div className="auth-wordmark">GRAVITY</div>
        </div>
        <h1 className="auth-headline">
          Intelligence,<br />assembled.
        </h1>
        <p className="auth-tagline">
          State an intent. GRAVITY assembles the right intelligence behind it.
        </p>
        <div className="auth-features">
          <div className="auth-feature">
            <span className="auth-feature-dot" />
            <span>Multi-model AI pipeline</span>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-dot" />
            <span>Zero-cost statistical engine</span>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-dot" />
            <span>Decision-ready outputs</span>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-kicker">
            {mode === "login" ? "Sign in" : "Get started"}
          </div>
          <h2 className="auth-card-title">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="auth-card-subtitle">
            {mode === "login"
              ? "Enter your credentials to access GRAVITY Studio."
              : "Free tier included. No credit card required."}
          </p>

          {error && (
            <div className="auth-error">{error}</div>
          )}

          {success && (
            <div className="auth-success">{success}</div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="auth-input"
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="auth-input-toggle"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="auth-button"
            >
              {busy ? (
                <span className="auth-button-loading">
                  <span className="auth-spinner" />
                  Working…
                </span>
              ) : (
                mode === "login" ? "Sign in" : "Create account"
              )}
            </button>
          </form>

          <div className="auth-switch">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="auth-link">Sign up</Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/login" className="auth-link">Sign in</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
