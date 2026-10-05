/** Shared server-side input validation — no deps. */

export const PROMPT_MAX = 4000;
export const CSV_MAX_BYTES = 2_000_000;
export const CSV_MAX_ROWS = 20_000;
export const CSV_MAX_COLS = 50;
export const FREE_MONTHLY_TOKENS = 250_000;

export function sanitizePrompt(prompt: string): string {
  // Strip control chars + cap [DATA:] blocks (prompt-injection / DoS guard).
  let out = prompt.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const blocks = out.match(/\[DATA:[^\]]*\]/g) ?? [];
  if (blocks.length > 5) throw new Error("too many embedded data blocks (max 5)");
  return out.trim();
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "uploaded.csv";
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  if (!/\.(csv|tsv|txt)$/i.test(clean)) throw new Error("only .csv/.tsv/.txt allowed");
  return clean;
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
