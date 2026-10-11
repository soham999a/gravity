"use client";

import * as React from "react";
import { ArrowRight, FileImage, FileSpreadsheet, FileText, Paperclip, X } from "lucide-react";
import { IMAGE_MODELS, type ImageModelId } from "@/lib/gravity/imageModels";

export type AttachKind = "csv" | "text" | "image" | "file";

export interface CsvFile {
  data: string;
  name: string;
  kind: AttachKind;
  size: number;
}

/** Every file is attachable. Text goes to the engine; images preview;
 *  anything else rides as metadata (never binary in the prompt). */
const TEXT_EXTS = new Set([
  "csv", "tsv", "txt", "md", "markdown", "json", "jsonl", "log",
  "js", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java", "c",
  "h", "cpp", "cs", "html", "css", "xml", "yaml", "yml", "toml",
  "ini", "cfg", "sql", "sh", "r", "scala", "kt",
]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"]);
const MAX_FILES = 5;
const MAX_TEXT_CHARS = 8000;

export function kindOf(name: string, type: string): AttachKind {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (type.startsWith("image/") || IMAGE_EXTS.has(ext)) return "image";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (TEXT_EXTS.has(ext) || type.startsWith("text/")) return "text";
  return "file";
}

export function TaskComposer({
  initialValue = "",
  busy = false,
  compact = false,
  autoFocus = false,
  onSubmit,
}: {
  initialValue?: string;
  busy?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
  onSubmit: (prompt: string, files?: CsvFile[], imageModel?: ImageModelId) => void;
}) {
  const [prompt, setPrompt] = React.useState(initialValue);
  const [files, setFiles] = React.useState<CsvFile[]>([]);
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const [attachError, setAttachError] = React.useState<string | null>(null);
  const [imageModel, setImageModel] = React.useState<ImageModelId>("auto");
  const [dragOver, setDragOver] = React.useState(false);
  const [boxHeight, setBoxHeight] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const canSubmit = prompt.trim().length > 0 && !busy;
  const textChars = files.reduce((s, f) => s + (f.kind === "csv" || f.kind === "text" ? f.data.length : 0), 0);

  /** Drag the divider line to resize the chatbox (pointer + keyboard). */
  const resizeFrom = React.useRef({ y: 0, h: 0 });
  const clampHeight = (h: number) =>
    Math.max(72, Math.min(h, Math.round(window.innerHeight * 0.6)));
  const onResizeStart = (clientY: number) => {
    resizeFrom.current = { y: clientY, h: boxHeight ?? guessPromptHeight() };
  };
  const onResizeMove = (clientY: number) => {
    // Dragging UP expands the box.
    setBoxHeight(clampHeight(resizeFrom.current.h + (resizeFrom.current.y - clientY)));
  };
  const guessPromptHeight = () => {
    const el = fileInputRef.current
      ?.closest(".gravity-composer")
      ?.querySelector("textarea.studio-prompt");
    return el instanceof HTMLElement && el.offsetHeight > 40 ? el.offsetHeight : 140;
  };

  const addFile = (file: File) => {
    setAttachError(null);
    if (files.length >= MAX_FILES) {
      setAttachError(`Max ${MAX_FILES} files — remove one first.`);
      return;
    }
    const kind = kindOf(file.name, file.type);
    if (kind === "image") {
      // Preview only — binary never enters the prompt or the database.
      const url = URL.createObjectURL(file);
      const key = `${file.name}-${file.size}`;
      setPreviews((p) => ({ ...p, [key]: url }));
      setFiles((prev) => [...prev, { data: "", name: file.name, kind, size: file.size }]);
      return;
    }
    if (kind === "file") {
      // Metadata only: name + size ride a one-line marker (no binary).
      setFiles((prev) => [...prev, { data: "", name: file.name, kind, size: file.size }]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const data = raw.length > MAX_TEXT_CHARS ? `${raw.slice(0, MAX_TEXT_CHARS)}\n…[truncated at ${MAX_TEXT_CHARS} chars]` : raw;
      setFiles((prev) =>
        prev.length >= MAX_FILES
          ? prev
          : [...prev, { data, name: file.name, kind, size: file.size }],
      );
    };
    reader.onerror = () => setAttachError(`Couldn't read ${file.name}.`);
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
    setFiles((prev) => {
      const gone = prev[index];
      if (gone && gone.kind === "image") {
        const key = `${gone.name}-${gone.size}`;
        const url = previews[key];
        if (url) URL.revokeObjectURL(url);
        setPreviews((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      }
      return prev.filter((_, i) => i !== index);
    });
    setAttachError(null);
  };

  const clearFiles = () => {
    Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    setPreviews({});
    setFiles([]);
    setAttachError(null);
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(
      prompt.trim(),
      files.length > 0 ? files : undefined,
      imageModel,
    );
    // Clear the box after sending — ChatGPT-style. The submitted prompt is
    // already captured by the parent (thread + mission), so keeping the old
    // text here only forces manual deletion before the next task.
    setPrompt("");
    setFiles([]);
  };

  const totalSize = files.reduce(
    (sum, f) => sum + (f.kind === "csv" || f.kind === "text" ? new TextEncoder().encode(f.data).length : f.size),
    0,
  );

  const fmtKB = (bytes: number) =>
    bytes < 1024
      ? `${bytes} B`
      : `${(bytes / 1024).toFixed(1)} KB`;

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
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {attachError ? (
        <p className="gravity-composer-error" role="alert">{attachError}</p>
      ) : null}

      {files.length > 0 ? (
        <div className="gravity-composer-files">
          <div className="gravity-composer-files-head">
            <span>{files.length}/{MAX_FILES} attached</span>
            <span>{fmtKB(textChars)} text</span>
            <button type="button" onClick={clearFiles} className="gravity-composer-clear">
              Clear all
            </button>
          </div>
          {files.map((f, i) => {
            const Icon = f.kind === "csv" ? FileSpreadsheet : f.kind === "image" ? FileImage : FileText;
            const thumb = f.kind === "image" ? previews[`${f.name}-${f.size}`] : undefined;
            return (
              <div key={`${f.name}-${i}`} className="gravity-composer-file">
                {thumb ? (
                  <img src={thumb} alt="" aria-hidden="true" className="gravity-composer-thumb" />
                ) : (
                  <Icon className="size-4 text-gold shrink-0" />
                )}
                <span className="truncate max-w-[180px]">{f.name}</span>
                <span className="gravity-composer-file-kind">{f.kind.toUpperCase()}</span>
                <span className="gravity-composer-file-size">
                  {fmtKB(f.kind === "csv" || f.kind === "text" ? f.data.length : f.size)}
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
            );
          })}
          <div className="gravity-composer-file-summary">
            {files.length} file{files.length > 1 ? "s" : ""} · {fmtKB(totalSize)} total
          </div>
        </div>
      ) : null}

      <div className="gravity-composer-top">
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
          rows={compact ? 1 : 2}
          style={boxHeight ? { height: `${boxHeight}px` } : undefined}
          placeholder={
            files.length > 0
              ? "Describe what you want to analyze in this data…"
              : "Tell GRAVITY what you want to create…"
          }
          aria-label="Tell GRAVITY what you want to create"
          autoFocus={autoFocus}
          className="studio-prompt"
        />
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the chatbox — drag or use arrow keys"
        tabIndex={0}
        className="gravity-composer-resize"
        onPointerDown={(event) => {
          event.preventDefault();
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* synthetic/inactive pointers can't capture — drag still tracks while held */
          }
          onResizeStart(event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons > 0) onResizeMove(event.clientY);
        }}
        onDoubleClick={() => setBoxHeight(null)}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 64 : 24;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setBoxHeight((h) => clampHeight((h ?? guessPromptHeight()) + step));
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setBoxHeight((h) => clampHeight((h ?? guessPromptHeight()) - step));
          }
        }}
      />
      <div className="gravity-composer-bottom">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="gravity-composer-attach"
            title="Attach any file — CSV, text, code, images"
          >
            <Paperclip className="size-3.5" />
            <span className="hidden sm:inline">{files.length > 0 ? "Add more" : "Attach"}</span>
          </button>
          <label className="flex items-center gap-1.5" title="Image model — used when GRAVITY routes to image generation">
            <span className="gravity-composer-hint hidden sm:inline">IMG</span>
            <select
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value as ImageModelId)}
              className="rounded border border-border bg-surface px-1.5 py-1 text-[11px] text-ivory"
              aria-label="Image generation model"
            >
              {IMAGE_MODELS.map((m) => (
                <option key={m.id} value={m.id} title={m.hint}>
                  {m.label} · {m.hint}
                </option>
              ))}
            </select>
          </label>
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
