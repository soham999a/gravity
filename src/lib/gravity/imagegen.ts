/**
 * Image generation via Pollinations.ai — free, no API key.
 * Returns URLs to generated images (the API redirects to the actual image).
 */

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

export interface ImageGenResult {
  url: string;
  prompt: string;
  width: number;
  height: number;
  seed: number;
}

/**
 * Infer output dimensions from the user's intent — asking for a "poster" and
 * getting a 1024x1024 square wastes most of the composition. Free fix: just
 * pick the right canvas shape. Diffusion models respond strongly to aspect.
 */
export function inferDimensions(prompt: string): { width: number; height: number } {
  const p = prompt.toLowerCase();
  // Portrait-first intents (order matters: poster beats wallpaper)
  if (/(?:poster|flyer|book cover|album cover|movie poster|portrait|character sheet|phone wallpaper)/.test(p)) {
    return { width: 832, height: 1216 };
  }
  // Wide intents
  if (/(?:banner|header|landscape|wallpaper|desktop|cinematic|wide|panorama|panoramic|website hero)/.test(p)) {
    return { width: 1216, height: 832 };
  }
  return { width: 1024, height: 1024 };
}

/**
 * Generate an image from a text prompt.
 * Pollinations returns the image directly as a redirect — no API key needed.
 */
export function generateImageURL(
  prompt: string,
  options?: { width?: number; height?: number; seed?: number },
): ImageGenResult {
  const dims = inferDimensions(prompt);
  const width = options?.width ?? dims.width;
  const height = options?.height ?? dims.height;
  const seed = options?.seed ?? Math.floor(Math.random() * 999999);

  const enhancedPrompt = enhancePrompt(prompt);
  const encoded = encodeURIComponent(enhancedPrompt);

  const url = `${POLLINATIONS_BASE}/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

  return { url, prompt: enhancedPrompt, width, height, seed };
}

/**
 * Generate multiple image variations with different seeds.
 * Dimensions come from intent detection (poster → portrait, banner → wide).
 */
export function generateImageVariations(
  prompt: string,
  count: number = 2,
): ImageGenResult[] {
  const baseSeed = Math.floor(Math.random() * 900000);
  return Array.from({ length: count }, (_, i) =>
    generateImageURL(prompt, { seed: baseSeed + i }),
  );
}

/**
 * Typographic overlay: text rendered by HTML/CSS on top of the AI background.
 * Diffusion models garble rendered text — real DOM type never does.
 */
export interface PosterOverlay {
  text: string;
  placement: "center" | "bottom" | "top";
  /** CSS color for the type */
  color: string;
  /** Optional semi-transparent scrim color behind the type */
  bgColor?: string;
}

/** What the planner returns before a single pixel is rendered. */
export interface ImagePlan {
  /** Diffusion prompt — background-only when an overlay is present. */
  imagePrompt: string;
  overlay: PosterOverlay | null;
  enhanced: boolean;
}

const NO_TEXT_SUFFIX =
  ", no text, no lettering, no typography, clean uncluttered negative space reserved for typography";

const PLACEMENTS = ["center", "bottom", "top"] as const;

function validColor(c: unknown): string | null {
  if (typeof c !== "string") return null;
  const s = c.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(?:white|black|ivory|gold|silver|cream|beige|charcoal|navy|maroon)$/.test(s.toLowerCase())) {
    const map: Record<string, string> = {
      white: "#ffffff", black: "#111111", ivory: "#fffff0", gold: "#d4a437",
      silver: "#c0c0c0", cream: "#fffdd0", beige: "#f5f5dc", charcoal: "#36454f",
      navy: "#000080", maroon: "#800000",
    };
    return map[s.toLowerCase()];
  }
  return null;
}

/** Pull a short quoted phrase out of the raw prompt (heuristic fallback). */
function extractQuotedText(userPrompt: string): string | null {
  const m = userPrompt.match(/"([^"\n]{1,40})"/);
  return m ? m[1].trim() : null;
}

function heuristicPlan(userPrompt: string): ImagePlan {
  const quoted = extractQuotedText(userPrompt);
  const overlay: PosterOverlay | null = quoted
    ? { text: quoted, placement: "bottom", color: "#ffffff" }
    : null;
  const base = enhancePrompt(userPrompt);
  const imagePrompt = overlay ? `${base}${NO_TEXT_SUFFIX}` : base;
  return { imagePrompt, overlay, enhanced: false };
}

/**
 * Plan an image BEFORE rendering: rewrite the user's idea into a rich
 * diffusion prompt with the already-configured free LLM (Gemini 2.5 Flash /
 * Groq), and decide whether words belong in the image at all. Long rendered
 * text always garbles — 1-4 words go to an HTML/CSS overlay instead, and the
 * diffusion prompt is explicitly told to leave negative space for it.
 *
 * Never throws; falls back to a heuristic plan on any failure.
 */
export async function planImagePrompts(
  userPrompt: string,
  opts?: { budgetMs?: number },
): Promise<ImagePlan> {
  const budgetMs = opts?.budgetMs ?? 12_000;
  try {
    const { isLLMConfigured, callLLM } = await import("@/lib/gravity/llm");
    if (!isLLMConfigured()) return heuristicPlan(userPrompt);

    const res = await callLLM({
      tier: "small",
      json: true,
      timeoutMs: Math.max(4_000, budgetMs),
      maxTokens: 320,
      temperature: 0.4,
      system:
        "You are a prompt engineer for text-to-image diffusion models (Flux). " +
        'Reply ONLY with JSON: {"image_prompt": string, "overlay": {"text": string, "placement": "center"|"bottom"|"top", "color": hex} | null}.\n' +
        "Rules for image_prompt:\n" +
        "- ONE rich English prompt: subject, composition, lighting, palette, art style, mood, medium. 60 words max.\n" +
        "- If overlay is non-null, image_prompt must describe the BACKGROUND ONLY with clean negative space where the type will sit — no words in the image.\n" +
        "- If the user asked for long text (sentences, paragraphs) in the image, set overlay to the single most important word or 2-4 word phrase, or null if nothing fits.\n" +
        "- If the user quoted short words to render, use exactly those words as overlay text.\n" +
        "- overlay.color must contrast with the described palette (light palette -> dark type or vice versa).\n" +
        "- No watermarks, signatures, borders or logos in image_prompt.",
      prompt: userPrompt.slice(0, 800),
    });

    const raw = res.text;
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return heuristicPlan(userPrompt);
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      image_prompt?: string;
      overlay?: { text?: string; placement?: string; color?: string } | null;
    };

    const imagePrompt = String(parsed.image_prompt ?? "").trim();
    if (imagePrompt.length < 10 || imagePrompt.length > 900) {
      return heuristicPlan(userPrompt);
    }

    let overlay: PosterOverlay | null = null;
    if (parsed.overlay && typeof parsed.overlay.text === "string") {
      const text = parsed.overlay.text.trim().slice(0, 40);
      const color = validColor(parsed.overlay.color) ?? "#ffffff";
      const placement = (PLACEMENTS as readonly string[]).includes(parsed.overlay.placement ?? "")
        ? (parsed.overlay.placement as PosterOverlay["placement"])
        : "bottom";
      if (text) overlay = { text, placement, color };
    }

    return {
      imagePrompt: overlay ? `${imagePrompt}${NO_TEXT_SUFFIX}` : imagePrompt,
      overlay,
      enhanced: true,
    };
  } catch {
    return heuristicPlan(userPrompt);
  }
}

/**
 * Self-heal helper: rewrite the render prompt to fix the defect the vision
 * verifier reported. Deterministic concat keeps this instant and free; the
 * verifier feedback is already a decisive one-liner.
 */
export function buildRepairPrompt(originalPrompt: string, feedback: string): string {
  const fix = feedback.trim().replace(/\s+/g, " ").slice(0, 220);
  return `${originalPrompt}, corrected: ${fix}`.slice(0, 900);
}

/**
 * Free failover generator seam: Together AI's FLUX.1-schnell-Free endpoint.
 * Dormant unless TOGETHER_API_KEY is set — the app stays 100% key-free
 * without it and simply never calls this.
 */
export function secondaryImageProvider(): string | null {
  return process.env.TOGETHER_API_KEY ? "together" : null;
}

export async function generateSecondaryImage(
  prompt: string,
  width: number,
  height: number,
  seed: number,
): Promise<string | null> {
  if (!process.env.TOGETHER_API_KEY) return null;
  try {
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell-Free",
        prompt,
        width,
        height,
        seed,
        steps: 4,
        n: 1,
        response_format: "url",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { url?: string }[] };
    return data.data?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Enhance a user prompt for better image generation quality.
 */
function enhancePrompt(userPrompt: string): string {
  const lower = userPrompt.toLowerCase();

  // Already has quality cues — use as-is
  if (/(?:photo|realistic|photograph|cinematic|35mm|8k|hdr|raw)/i.test(userPrompt)) {
    return userPrompt;
  }

  // Logo/icon style
  if (/(?:logo|icon|minimal|flat|vector|symbol|emblem)/i.test(lower)) {
    return `${userPrompt}, vector style, flat design, clean background, sharp edges, professional branding, 4k`;
  }

  // Illustration/art style
  if (/(?:illustration|drawing|sketch|art|painting|watercolor|oil)/i.test(lower)) {
    return `${userPrompt}, digital art, detailed illustration, vibrant colors, artstation quality, 4k`;
  }

  // Fantasy/concept
  if (/(?:fantasy|sci-fi|cyberpunk|steampunk|dragon|magic|alien|space)/i.test(lower)) {
    return `${userPrompt}, concept art, dramatic lighting, highly detailed, cinematic composition, 4k`;
  }

  // Portrait/character
  if (/(?:portrait|character|person|face|warrior|knight|mage)/i.test(lower)) {
    return `${userPrompt}, detailed portrait, dramatic lighting, sharp focus, professional, 4k`;
  }

  // Landscape/scenery
  if (/(?:landscape|scenery|mountain|ocean|forest|city|sunset|sunrise)/i.test(lower)) {
    return `${userPrompt}, breathtaking landscape, golden hour lighting, vivid colors, panoramic, 8k`;
  }

  // Default: high quality enhancement
  return `${userPrompt}, masterpiece, best quality, highly detailed, sharp focus, professional, 4k`;
}
