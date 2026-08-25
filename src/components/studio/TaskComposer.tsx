"use client";

import * as React from "react";
import { ArrowRight, Sparkles } from "lucide-react";

export function TaskComposer({
  initialValue = "",
  busy = false,
  compact = false,
  onSubmit,
}: {
  initialValue?: string;
  busy?: boolean;
  compact?: boolean;
  onSubmit: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = React.useState(initialValue);
  const canSubmit = prompt.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(prompt.trim());
  };

  return (
    <div className="gravity-composer">
      <div className="gravity-composer-top">
        <Sparkles className="gravity-composer-spark" size={18} />
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={compact ? 2 : 4}
          placeholder="Tell GRAVITY what you want to create…"
          aria-label="Tell GRAVITY what you want to create"
          className="studio-prompt"
        />
      </div>
      <div className="gravity-composer-bottom">
        <span className="gravity-composer-hint">
          ENTER TO RUN · SHIFT+ENTER NEW LINE · GRAVITY PICKS THE RIGHT INTELLIGENCE
        </span>
        <button type="button" onClick={submit} disabled={!canSubmit} className="studio-primary-button">
          <span>{busy ? "Working…" : "Create"}</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
