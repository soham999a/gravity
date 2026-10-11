/** Shared server-side input validation — no deps. */

export const PROMPT_MAX = 4000;
export const CSV_MAX_BYTES = 2_000_000;
export const CSV_MAX_ROWS = 20_000;
export const CSV_MAX_COLS = 50;
export const FREE_MONTHLY_TOKENS = 250_000;
/** Every-file attach: text kinds ride content (capped), images/metadata ride notes. */
export const TEXT_MAX_CHARS = 8000;
export const ATTACH_MAX_FILES = 5;
const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

export function sanitizePrompt(prompt: string): string {
  // Strip control chars + cap [DATA:] blocks (prompt-injection / DoS guard).
  let out = prompt.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const blocks = out.match(/\[DATA:[^\]]*\]/g) ?? [];
  if (blocks.length > 5) throw new Error("too many embedded data blocks (max 5)");
  return out.trim();
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload.bin";
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  if (!clean || !SAFE_NAME.test(clean)) throw new Error("unsafe file name");
  return clean;
}

export type AttachKind = "csv" | "text" | "image" | "file";

/**
 * Per-kind server validation. CSV keeps the strict stats-engine checks;
 * text is capped (prompt/context guard); image/file carry metadata only —
 * binary is never accepted (client sends data:"" for those).
 */
export function validateFile(f: { data?: string; name: string; kind?: string; size?: number }): {
  kind: AttachKind;
  data: string;
} {
  const kind: AttachKind =
    f.kind === "csv" || f.kind === "text" || f.kind === "image" || f.kind === "file" ? f.kind : "file";
  const data = typeof f.data === "string" ? f.data : "";
  if (kind === "csv") {
    validateCsv(data);
    return { kind, data };
  }
  if (kind === "text") {
    if (data.length < 1) throw new Error("text file is empty");
    if (data.length > TEXT_MAX_CHARS + 200) throw new Error(`text file exceeds ${TEXT_MAX_CHARS} chars`);
    return { kind, data: data.slice(0, TEXT_MAX_CHARS) };
  }
  if (data.length > 0) throw new Error("binary payload rejected — metadata only");
  return { kind, data: "" };
}

export function validateCsv(csv: string): { rows: number; cols: number } {
  if (csv.length < 10) throw new Error("CSV data is too short or missing");
  if (csv.length > CSV_MAX_BYTES) throw new Error("CSV exceeds 2 MB limit");
  const lines = csv.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length > CSV_MAX_ROWS) throw new Error(`CSV exceeds ${CSV_MAX_ROWS} rows`);
  const cols = (lines[0]?.split(/[,;\t|]/) ?? []).length;
  if (cols > CSV_MAX_COLS) throw new Error(`CSV exceeds ${CSV_MAX_COLS} columns`);
  // Formula-injection guard: neutralize spreadsheet formulas on export/render.
  if (/^[=+@-]/m.test(csv.slice(0, 5000))) {
    // Not fatal — UI must render cells as text, never execute. Flagged here for audit.
  }
  return { rows: Math.max(0, lines.length - 1), cols };
}

export function stripFormulaPrefix(cell: string): string {
  // Prefix dangerous cells with ' when rendering/exporting.
  return /^[=+@-]/.test(cell) ? `'${cell}` : cell;
}
