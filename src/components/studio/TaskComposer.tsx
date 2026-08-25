"use client";

import * as React from "react";
import { ArrowRight, FileSpreadsheet, Paperclip, Sparkles, X } from "lucide-react";

export function TaskComposer({
  initialValue = "",
  busy = false,
  compact = false,
  onSubmit,
}: {
  initialValue?: string;
  busy?: boolean;
  compact?: boolean;
  onSubmit: (prompt: string, csvData?: string, csvFileName?: string) => void;
}) {
  const [prompt, setPrompt] = React.useState(initialValue);
  const [csvData, setCsvData] = React.useState<string | null>(null);
  const [csvFileName, setCsvFileName] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const canSubmit = prompt.trim().length > 0 && !busy;

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".tsv") && !file.name.endsWith(".txt")) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsvData(reader.result as string);
      setCsvFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // If clipboard contains a file, handle it
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            return;
          }
        }
      }
    }
  };

  const removeFile = () => {
    setCsvData(null);
    setCsvFileName(null);
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(
      prompt.trim(),
      csvData ?? undefined,
      csvFileName ?? undefined,
    );
    // Don't clear CSV — user might want to iterate
  };

  return (
    <div
      className={`gravity-composer ${dragOver ? "gravity-composer-dragover" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {csvFileName ? (
        <div className="gravity-composer-file">
          <FileSpreadsheet className="size-4 text-gold" />
          <span className="truncate max-w-[200px]">{csvFileName}</span>
          <span className="text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted-foreground)" }}>
            {csvData ? `${(csvData.length / 1024).toFixed(1)} KB` : ""}
          </span>
          <button
            type="button"
            onClick={removeFile}
            className="ml-auto text-[color:var(--color-muted-foreground)] hover:text-gold"
            aria-label="Remove file"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

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
          onPaste={handlePaste}
          rows={compact ? 2 : 4}
          placeholder={
            csvFileName
              ? "Describe what you want to analyze in this data…"
              : "Tell GRAVITY what you want to create…"
          }
          aria-label="Tell GRAVITY what you want to create"
          className="studio-prompt"
        />
      </div>
      <div className="gravity-composer-bottom">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="gravity-composer-attach"
            title="Attach a CSV file"
          >
            <Paperclip className="size-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <span className="gravity-composer-hint">
            ENTER TO RUN · SHIFT+ENTER NEW LINE
          </span>
        </div>
        <button type="button" onClick={submit} disabled={!canSubmit} className="studio-primary-button">
          <span>{busy ? "Working…" : "Create"}</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>

      {dragOver ? (
        <div className="gravity-composer-dragoverlay">
          <FileSpreadsheet className="size-6 text-gold" />
          <span className="studio-eyebrow mt-2">DROP CSV FILE</span>
        </div>
      ) : null}
    </div>
  );
}
