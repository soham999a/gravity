/**
 * Prompt display helpers.
 *
 * Uploaded files are embedded in the stored mission prompt as
 * `[DATA:csv:name] ... [/DATA]` blocks so the execution engine can locate
 * them. Those payloads must NEVER reach the UI — the user already has their
 * data, and echoing it back (whole CSVs in the run panel, thread, projects
 * list, titles) reads as a low-quality product. These helpers are pure and
 * shared by client components and server code.
 */

/** Matches a complete embedded-data block, tolerant to the exact tag. */
const DATA_BLOCK_RE = /\[DATA:(?:csv)?(?::([^\]]+))?\]\n?[\s\S]*?\n?\[\/DATA\]/g;

/** File names embedded in the prompt, in upload order. */
export function attachedFileNames(prompt: string): string[] {
  return [...prompt.matchAll(/\[DATA:(?:csv)?(?::([^\]]+))?\]/g)].map(
    (m) => m[1]?.trim() || "data.csv",
  );
}

/** Prompt text safe to show to the user: each data payload becomes one chip. */
export function displayPrompt(prompt: string): string {
  const out = prompt
    .replace(
      DATA_BLOCK_RE,
      (_m, name) => `\n[attached: ${(name ?? "data.csv").trim()}]\n`,
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out || prompt.trim();
}

/** Prompt text with data payloads removed entirely (titles, briefs, exports). */
export function stripDataMarkers(prompt: string): string {
  const out = prompt
    .replace(DATA_BLOCK_RE, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out || prompt.trim();
}
