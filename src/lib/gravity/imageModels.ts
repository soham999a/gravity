/**
 * Client-safe image model menu — ZERO server imports (no firebase-admin,
 * no node builtins). Safe to import from "use client" components.
 * Server logic lives in imageOpenRouter.ts, which re-exports from here.
 */

export const IMAGE_MODELS = [
  { id: "auto", label: "Auto HD", hint: "best paid first · free fallback" },
  { id: "google/gemini-3.1-flash-image", label: "Gemini Image", hint: "best text · ~$0.04" },
  { id: "bytedance-seed/seedream-5-0-pro", label: "Seedream Pro", hint: "photoreal · ~$0.07" },
  { id: "openai/gpt-image-2.5-sunburst", label: "GPT Image", hint: "premium · ~$0.13" },
  { id: "free", label: "Free", hint: "$0 · Pollinations only" },
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];

/** Paid slugs only — "auto" and "free" are modes, not models. */
const PAID_SLUGS = new Set<string>(
  IMAGE_MODELS.map((m) => m.id).filter((id) => id !== "auto" && id !== "free"),
);

export function normalizeImageModel(raw: unknown): ImageModelId {
  const v = String(raw ?? "auto").trim();
  if (v === "free" || v === "auto") return v;
  // Allow exact slugs only — a typo must not silently bill the wrong model.
  if (PAID_SLUGS.has(v)) return v as ImageModelId;
  return "auto";
}
