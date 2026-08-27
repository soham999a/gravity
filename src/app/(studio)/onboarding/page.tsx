"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { INTENTS, useGravityUser } from "@/lib/gravity-user";
import { toast } from "@/components/studio/toast";

const STEPS = [
  { label: "IDENTITY", title: "Let's set you up.", copy: "A few details so GRAVITY can address you the way you prefer." },
  { label: "INTENT", title: "What will you build here?", copy: "Pick every surface you expect to use. This tunes your starting points — you can change it later." },
  { label: "READY", title: "Framed and ready.", copy: "Your studio is personalized. Jump straight into the surface." },
];

const ROLES = [
  { value: "founder", label: "Founder / Builder" },
  { value: "ops", label: "Operations lead" },
  { value: "analyst", label: "Analyst / Researcher" },
  { value: "engineer", label: "Engineer" },
  { value: "creative", label: "Creative / Marketing" },
  { value: "other", label: "Something else" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const user = useGravityUser();
  const { complete, update } = user;

  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState(user.name ?? "");
  const [role, setRole] = React.useState(user.role ?? "");
  const [intents, setIntents] = React.useState<string[]>(user.intents ?? []);

  const toggleIntent = (label: string) =>
    setIntents((current) =>
      current.includes(label) ? current.filter((i) => i !== label) : [...current, label],
    );

  const finish = (skip: boolean) => {
    if (skip) {
      complete({ name: name.trim() || "GRAVITY user", role: role || "creator", intents: [] });
      toast("Welcome to GRAVITY", "You can personalize later from Settings.");
    } else {
      complete({ name: name.trim() || "GRAVITY user", role: role || "creator", intents });
      toast("Studio is ready", "Your personalization is saved. Start creating.", "success");
    }
    router.replace("/");
  };

  const canContinue = step === 0 ? true : step === 1 ? true : true;

  const nextStep = () => {
    update({ name: name.trim() || "GRAVITY user", role: role || "creator" });
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const backStep = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="onboard-page">
      <div className="onboard-card">
        <div className="onboard-progress">
          <span className="studio-meta">STEP {String(step + 1).padStart(2, "0")} / 03</span>
          <div className="onboard-progress-bar">
            <div
              className="onboard-progress-fill"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {step === 0 ? (
          <>
            <p className="onboard-kicker">01 / IDENTITY</p>
            <h1 className="onboard-title">{STEPS[0].title}</h1>
            <p className="onboard-copy">{STEPS[0].copy}</p>

            <div className="mt-8 grid gap-6">
              <div className="studio-field">
                <label className="studio-label" htmlFor="ob-name">
                  Your name
                </label>
                <input
                  id="ob-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  autoFocus
                  className="studio-input"
                  autoComplete="name"
                />
              </div>
              <div className="studio-field">
                <label className="studio-label" htmlFor="ob-role">
                  What do you do most?
                </label>
                <select
                  id="ob-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="studio-select"
                >
                  <option value="">Choose a role…</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <p className="onboard-kicker">02 / INTENT</p>
            <h1 className="onboard-title">{STEPS[1].title}</h1>
            <p className="onboard-copy">{STEPS[1].copy}</p>

            <div className="onboard-intent-grid">
              {INTENTS.map((intent) => {
                const selected = intents.includes(intent.label);
                return (
                  <button
                    key={intent.label}
                    type="button"
                    onClick={() => toggleIntent(intent.label)}
                    aria-pressed={selected}
                    className={`onboard-intent ${selected ? "onboard-intent-selected" : ""}`}
                  >
                    <span className="onboard-intent-check">
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                    <span>
                      <span className="onboard-intent-label">{intent.label}</span>
                      <span className="onboard-intent-desc block">{intent.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <div className="onboard-summary">
            <p className="onboard-kicker">03 / READY</p>
            <h1 className="onboard-title">
              {name.trim() || "GRAVITY user"}, your studio is framed.
            </h1>
            <p className="onboard-copy">
              Your starting points and preferences are saved. From here GRAVITY routes every task to
              the least complex sufficient intelligence — and makes the reasoning visible when you
              want it.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {intents.length > 0 ? (
                intents.map((i) => (
                  <span key={i} className="studio-example-chip !text-gold">
                    {i}
                  </span>
                ))
              ) : (
                <span className="studio-example-chip">EXPLORING SURFACES</span>
              )}
              <span className="studio-example-chip">
                {ROLES.find((r) => r.value === role)?.label ?? "CREATOR"}
              </span>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <Sparkles className="size-4 text-gold" />
              <span className="studio-meta">GRAVITY / STUDIO — SIMPLEX: SIMPLE DESIGN OF COMPLEXITY</span>
            </div>
          </div>
        ) : null}

        <div className="onboard-actions">
          <button type="button" onClick={() => finish(true)} className="onboard-skip">
            Skip setup
          </button>
          <div className="flex items-center gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={backStep}
                aria-label="Previous step"
                className="studio-icon-button"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canContinue}
                className="studio-primary-button"
              >
                Continue <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <button type="button" onClick={() => finish(false)} className="studio-primary-button">
                Enter studio <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}