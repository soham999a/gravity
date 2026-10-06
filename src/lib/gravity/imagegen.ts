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
 * Free prompt-enhancer: rewrite the user's idea into a proper diffusion
 * prompt using an LLM we already have configured (Gemini 2.5 Flash free tier
 * or Groq). Diffusion models reward composition/lighting/palette detail and
 * punish long text demands — so we also neutralize "write X on it" asks into
 * short quoted strings (long rendered text always comes out garbled).
 *
 * Returns null on any failure — callers fall back to the raw prompt.
 */
export async function enhancePromptWithLLM(
  userPrompt: string,
  budgetMs = 12_000,
): Promise<string | null> {
  try {
    const { callLLM } = await import("@/lib/gravity/llm");
    const res = await callLLM({
      timeoutMs: Math.max(4_000, budgetMs),
      system:
        "You are a prompt engineer for text-to-image diffusion models (Flux). " +
        "Rewrite the user's request as ONE rich English image prompt.\n" +
        "Rules:\n" +
        "- Describe subject, composition, lighting, color palette, art style, mood, camera/medium.\n" +
        "- 60 words max. No preamble, no quotes around the whole thing, output the prompt only.\n" +
        "- If the user wants words rendered IN the image, keep at most 1-4 words and put them in double quotes (e.g. a sign that reads \"BREATHE\"). NEVER ask for sentences or paragraphs inside the image — replace with clean negative space.\n" +
        "- Do not add watermarks, signatures, borders, or logos.",
      prompt: userPrompt.slice(0, 800),
      maxTokens: 200,
      tier: "small",
    });
    const out = res.text.trim().replace(/^"+|"+$/g, "");
    if (!out || out.length < 10 || out.length > 900) return null;
    return out;
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
