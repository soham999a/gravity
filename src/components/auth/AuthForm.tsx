"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/studio/toast";

const featureLines = [
  "Multi-model AI pipeline",
  "Zero-cost statistical engine",
  "Decision-ready outputs",
];

const nodes = [
  [104, 136],
  [188, 100],
  [274, 132],
  [354, 96],
  [440, 150],
  [150, 238],
  [246, 204],
  [348, 238],
  [438, 210],
  [116, 340],
  [210, 300],
  [306, 346],
  [404, 302],
  [500, 354],
  [172, 428],
  [274, 398],
  [382, 438],
  [466, 406],
  [230, 520],
  [350, 500],
  [424, 548],
] as const;

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
    <main className="gravity-signin-page">
      <section className="gravity-signin-intro" aria-label="GRAVITY overview">
        <div className="gravity-signin-intro-inner">
          <a className="gravity-signin-brand" href="/" aria-label="GRAVITY home">
            <span className="gravity-signin-brand-mark">
              <img src="/logo.jpg" alt="" />
            </span>
            <span>GRAVITY</span>
          </a>

          <div className="gravity-signin-copy">
            <p className="gravity-signin-kicker">NEXT-GENERATION ADAPTIVE INTELLIGENCE FRAMEWORK</p>
            <h1>
              Intelligence,
              <br />
              assembled.
            </h1>
            <p className="gravity-signin-description">
              State an intent. GRAVITY assembles the right intelligence behind it.
            </p>
            <ul className="gravity-signin-features">
              {featureLines.map((feature) => (
                <li key={feature}>
                  <Check aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="gravity-signin-art" aria-hidden="true">
          <svg viewBox="0 0 640 640" focusable="false">
            <defs>
              <linearGradient id="signin-gold-line" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.08" />
                <stop offset="48%" stopColor="var(--color-gold)" stopOpacity="0.78" />
                <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0.12" />
              </linearGradient>
              <radialGradient id="signin-gold-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g className="gravity-signin-art-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <line
                  key={`vertical-${index}`}
                  x1={72 + index * 72}
                  y1="52"
                  x2={72 + index * 72}
                  y2="592"
                />
              ))}
              {Array.from({ length: 8 }).map((_, index) => (
                <line
                  key={`horizontal-${index}`}
                  x1="36"
                  y1={80 + index * 72}
                  x2="604"
                  y2={80 + index * 72}
                />
              ))}
            </g>
            <circle
              className="gravity-signin-art-glow"
              cx="320"
              cy="322"
              r="154"
              fill="url(#signin-gold-glow)"
            />
            <g className="gravity-signin-art-forms">
              <path d="M96 134 C176 80 252 116 318 182 S470 276 548 198" />
              <path d="M86 246 C172 186 242 224 310 298 S458 384 556 304" />
              <path d="M106 382 C188 326 258 360 322 428 S462 514 534 438" />
              <path d="M164 516 C230 466 290 476 344 522 S448 582 504 534" />
              <path
                className="gravity-signin-art-orbit"
                d="M124 326 C160 178 334 112 474 190 C590 254 542 442 390 516 C240 590 102 488 124 326Z"
              />
              <path
                className="gravity-signin-art-orbit gravity-signin-art-orbit-reverse"
                d="M204 480 C102 364 172 198 326 168 C472 140 574 256 514 390 C454 526 296 552 204 480Z"
              />
            </g>
            <g className="gravity-signin-art-connectors">
              {nodes.slice(0, -1).map(([x, y], index) => {
                const [nextX, nextY] = nodes[index + 1]!;
                return <line key={`connector-${x}-${y}`} x1={x} y1={y} x2={nextX} y2={nextY} />;
              })}
              <line x1="104" y1="136" x2="150" y2="238" />
              <line x1="188" y1="100" x2="246" y2="204" />
              <line x1="274" y1="132" x2="348" y2="238" />
              <line x1="354" y1="96" x2="438" y2="210" />
              <line x1="116" y1="340" x2="172" y2="428" />
              <line x1="210" y1="300" x2="274" y2="398" />
              <line x1="306" y1="346" x2="382" y2="438" />
              <line x1="404" y1="302" x2="466" y2="406" />
              <line x1="230" y1="520" x2="350" y2="500" />
            </g>
            <g className="gravity-signin-art-nodes">
              {nodes.map(([x, y], index) => (
                <circle
                  key={`node-${x}-${y}`}
                  cx={x}
                  cy={y}
                  r={index % 5 === 0 ? 4 : 2.5}
                  style={{ "--node-delay": `${index * 90}ms` } as React.CSSProperties}
                />
              ))}
            </g>
            <g className="gravity-signin-art-labels">
              <text x="72" y="610">
                INTENT / 01
              </text>
              <text x="492" y="610">
                FORMING / 04
              </text>
            </g>
          </svg>
          <p>Simplex: Simple Design of Complexity</p>
        </div>
      </section>

      <section
        className="gravity-signin-form-side"
        aria-label={mode === "login" ? "Sign in to GRAVITY Studio" : "Create your GRAVITY account"}
      >
        <div className="gravity-signin-grid-field" aria-hidden="true">
          <svg viewBox="0 0 760 900" focusable="false">
            <defs>
              <linearGradient id="signin-grid-gold" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.02" />
                <stop offset="52%" stopColor="var(--color-gold)" stopOpacity="0.58" />
                <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0.08" />
              </linearGradient>
              <radialGradient id="signin-grid-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect
              className="gravity-signin-grid-glow"
              x="160"
              y="180"
              width="440"
              height="440"
              fill="url(#signin-grid-glow)"
            />
            <g className="gravity-signin-grid-lines">
              {Array.from({ length: 9 }).map((_, index) => (
                <line
                  key={`grid-v-${index}`}
                  x1={42 + index * 84}
                  y1="80"
                  x2={42 + index * 84}
                  y2="820"
                />
              ))}
              {Array.from({ length: 10 }).map((_, index) => (
                <line
                  key={`grid-h-${index}`}
                  x1="42"
                  y1={80 + index * 82}
                  x2="718"
                  y2={80 + index * 82}
                />
              ))}
            </g>
            <g className="gravity-signin-grid-squares">
              <rect x="84" y="128" width="500" height="500" />
              <rect x="168" y="212" width="332" height="332" />
              <rect x="252" y="296" width="164" height="164" />
              <rect x="294" y="338" width="80" height="80" />
            </g>
            <g className="gravity-signin-grid-dots">
              {Array.from({ length: 7 }).map((_, index) => (
                <circle
                  key={`grid-dot-${index}`}
                  cx={126 + index * 84}
                  cy={170 + index * 82}
                  r={index === 3 ? 5 : 2.5}
                  style={{ "--grid-dot-delay": `${index * 420}ms` } as React.CSSProperties}
                />
              ))}
            </g>
            <path
              className="gravity-signin-grid-orbit"
              d="M116 474 C132 228 344 112 548 220 C700 300 624 610 398 690 C204 758 90 638 116 474Z"
            />
            <path
              className="gravity-signin-grid-orbit gravity-signin-grid-orbit-reverse"
              d="M186 610 C70 442 196 216 418 224 C606 232 674 424 538 584 C422 720 254 706 186 610Z"
            />
          </svg>
          <span>INTELLIGENCE FIELD / 01</span>
        </div>

        <div className="gravity-signin-form-wrap">
          <div className="gravity-signin-panel-brand" aria-label="GRAVITY">
            <span className="gravity-signin-panel-wordmark">GRAVITY</span>
            <span className="gravity-signin-panel-brand-line" />
          </div>

          <div className="gravity-signin-form-heading">
            <p className="gravity-signin-kicker">{mode === "login" ? "SIGN IN" : "SIGN UP"}</p>
            <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p>
              {mode === "login"
                ? "Enter your credentials to access GRAVITY Studio."
                : "Free tier included. No credit card required."}
            </p>
          </div>

          {error && <div className="gravity-signin-error">{error}</div>}
          {success && <div className="gravity-signin-success">{success}</div>}

          <form className="gravity-signin-form" onSubmit={handleSubmit}>
            <label htmlFor="gravity-email">EMAIL</label>
            <input
              id="gravity-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="gravity-password">PASSWORD</label>
            <div className="gravity-signin-password-field">
              <input
                id="gravity-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>

            <button className="gravity-signin-submit" type="submit" disabled={busy}>
              <span>
                {busy
                  ? "WORKING…"
                  : mode === "login"
                    ? "SIGN IN"
                    : "CREATE ACCOUNT"}
              </span>
              {busy ? (
                <span className="gravity-signin-spinner" />
              ) : (
                <ArrowRight aria-hidden="true" />
              )}
            </button>
          </form>

          <p className="gravity-signin-switch">
            {mode === "login" ? (
              <>
                Don&apos;t have an account? <Link href="/signup">Sign up</Link>
              </>
            ) : (
              <>
                Already have an account? <Link href="/login">Sign in</Link>
              </>
            )}
          </p>
        </div>

        <p className="gravity-signin-status">
          <span /> PROTOTYPE ENVIRONMENT / PROVIDER-AGNOSTIC
        </p>
      </section>
    </main>
  );
}