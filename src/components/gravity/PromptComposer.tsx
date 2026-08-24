"use client";

import * as React from "react";
import { Sparkles, ArrowRight } from "lucide-react";

export function PromptComposer({ onSubmit }: { onSubmit: (prompt: string) => void }) {
  const [prompt, setPrompt] = React.useState("");
  const canSubmit = prompt.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(prompt.trim());
    setPrompt("");
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
          rows={3}
          placeholder="Tell GRAVITY what you want to solve…"
          aria-label="Tell GRAVITY what you want to solve"
          className="gravity-prompt"
        />
      </div>
      <div className="gravity-composer-bottom">
        <span className="gravity-composer-hint">ENTER TO ROUTE · SHIFT+ENTER NEW LINE</span>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="gravity-primary-button"
        >
          Route Mission <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
