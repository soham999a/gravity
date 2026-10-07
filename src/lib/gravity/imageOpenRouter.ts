/**
 * Paid image generation via OpenRouter Unified Image API ($5 pay-as-you-go).
 *
 *   POST https://openrouter.ai/api/v1/images { model, prompt }
 *   → data[0].b64_json (base64 bytes, NOT a URL) + usage.cost (exact USD)
 *
 * The pipeline + verifier + UI all speak URLs, so bytes are uploaded to
 * Firebase Storage → signed URL. Any failure throws — the caller falls back
 * to free Pollinations, so paid is strictly an upgrade path, never a breakage.
 */

const IMAGES_URL = "https://openrouter.ai/api/v1/images";

// Menu lives in imageModels.ts (client-safe, no server imports).
// Re-exported here so server code has a single import point.
export { IMAGE_MODELS, normalizeImageModel } from "./imageModels";
export type { ImageModelId } from "./imageModels";
import type { ImageModelId } from "./imageModels";

/** Resolve the mode to an actual paid slug (or null for free-only). */
export function resolvePaidSlug(mode: ImageModelId): string | null {
  if (mode === "free") return null;
  if (mode !== "auto") return mode;
  if (!process.env.OPENROUTER_API_KEY) return null;
  return process.env.OPENROUTER_IMAGE_MODEL ?? "google/gemini-3.1-flash-image";
}

export interface PaidImageResult {
  url: string;
  prompt: string;
  width: number;
  height: number;
  model: string;
  costUsd: number | null;
}

function paidModel(requested?: ImageModelId): string | null {
  if (!process.env.OPENROUTER_API_KEY) return null;
  return resolvePaidSlug(requested ?? "auto");
}

export function isPaidImageConfigured(): boolean {
  return paidModel() !== null;
}

/** Map pipeline canvas dims → API aspect_ratio (union of Seedream/Gemini enums). */
function aspectFor(width: number, height: number): string {
  if (height > width * 1.2) return "2:3";
  if (width > height * 1.2) return "16:9";
  return "1:1";
}

interface ImagesResponse {
  data?: { b64_json?: string; url?: string; mime_type?: string }[];
  usage?: { cost?: number };
  error?: { message?: string; code?: number };
}

/**
 * Generate ONE HD image. Minimal body ({model, prompt}) — extra params vary
 * per endpoint and a wrong one 400s, so aspect/size ride along only as
 * prompt hints (the planner already bakes composition into the prompt).
 * Throws on any failure (auth, balance, render) — caller uses free fallback.
 */
export async function generatePaidImage(
  prompt: string,
  opts?: { width?: number; height?: number; runId?: string; model?: ImageModelId },
): Promise<PaidImageResult> {
  const model = paidModel(opts?.model);
  if (!model) throw new Error("paid image unavailable (free mode or no OPENROUTER_API_KEY)");
  const key = process.env.OPENROUTER_API_KEY!;

  const width = opts?.width ?? 1024;
  const height = opts?.height ?? 1024;
  void aspectFor(width, height);

  const res = await fetch(IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://gravity.matrka.net",
      "X-Title": "GRAVITY",
    },
    body: JSON.stringify({ model, prompt: prompt.slice(0, 1000) }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (res.status === 402) {
      throw new Error(
        `OpenRouter balance ≤$1 pre-auth — top up at openrouter.ai/credits (actual image ~$0.02-0.08). ${errText.slice(0, 120)}`,
      );
    }
    throw new Error(`OpenRouter image ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as ImagesResponse;
  if (data.error) throw new Error(`OpenRouter image error: ${data.error.message ?? "unknown"}`);
  const first = data.data?.[0];
  const costUsd = typeof data.usage?.cost === "number" ? data.usage.cost : null;

  // Some endpoints return a hosted URL directly — use it, no upload needed.
  if (first?.url) {
    return { url: first.url, prompt, width, height, model, costUsd };
  }
  if (!first?.b64_json) throw new Error("OpenRouter image: empty response (no b64_json/url)");

  const buffer = Buffer.from(first.b64_json, "base64");
  if (buffer.length < 1_000) throw new Error("OpenRouter image: suspiciously small payload");

  const { uploadImageBuffer } = await import("@/lib/firebase-admin");
  const stamp = Date.now().toString(36);
  const dest = `gravity-images/${opts?.runId ?? "adhoc"}/${stamp}.png`;
  const url = await uploadImageBuffer(buffer, dest, "image/png");
  return { url, prompt, width, height, model, costUsd };
}
