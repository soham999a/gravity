"use client";

import * as React from "react";
import { ArrowRight, FileSpreadsheet, Paperclip, Sparkles, X } from "lucide-react";

export interface CsvFile {
  data: string;
  name: string;
}

export function TaskComposer({
  initialValue = "",
  busy = false,
  compact = false,
  onSubmit,
}: {
  initialValue?: string;
  busy?: boolean;
  compact?: boolean;
  onSubmit: (prompt: string, files?: CsvFile[]) => void;
}) {
  const [prompt, setPrompt] = React.useState(initialValue);
  const [files, setFiles] = React.useState<CsvFile[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const canSubmit = prompt.trim().length > 0 && !busy;

  const addFile = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".tsv") && !file.name.endsWith(".txt")) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const csv = reader.result as string;
      setFiles((prev) => [...prev, { data: csv, name: file.name }]);
    };
    reader.readAsText(file);
  };

  const addFiles = (fileList: FileList) => {
    Array.from(fileList).forEach(addFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            addFile(file);
            return;
          }
        }
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(
      prompt.trim(),
      files.length > 0 ? files : undefined,
    );
  };

  const totalSize = files.reduce((sum, f) => sum + f.data.length, 0);

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
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 ? (
        <div className="gravity-composer-files">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="gravity-composer-file">
              <FileSpreadsheet className="size-4 text-gold shrink-0" />
              <span className="truncate max-w-[180px]">{f.name}</span>
              <span className="gravity-composer-file-size">
                {(f.data.length / 1024).toFixed(1)} KB
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-auto text-[color:var(--color-muted-foreground)] hover:text-gold shrink-0"
                aria-label={`Remove ${f.name}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="gravity-composer-file-summary">
            {files.length} file{files.length > 1 ? "s" : ""} · {(totalSize / 1024).toFixed(1)} KB total
          </div>
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
            files.length > 0
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
            title="Attach CSV files"
          >
            <Paperclip className="size-3.5" />
            <span className="hidden sm:inline">{files.length > 0 ? "Add more" : "CSV"}</span>
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
          <span className="studio-eyebrow mt-2">DROP CSV FILES</span>
        </div>
      ) : null}
    </div>
  );
}
