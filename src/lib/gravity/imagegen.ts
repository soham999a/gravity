/**
 * Image generation via Pollinations.ai — completely free, no API key needed.
 * Returns a URL to the generated image.
 */

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

export interface ImageGenResult {
  url: string;
  prompt: string;
  width: number;
  height: number;
  latencyMs: number;
}

/**
 * Generate an image from a text prompt using Pollinations.ai.
 * The API returns the image directly as a redirect — we just build the URL.
 */
export async function generateImage(
  prompt: string,
  options?: { width?: number; height?: number; seed?: number; model?: string },
): Promise<ImageGenResult> {
  const width = options?.width ?? 1024;
  const height = options?.height ?? 1024;
  const seed = options?.seed ?? Math.floor(Math.random() * 999999);

  const start = Date.now();

  // Enhance the prompt for better results
  const enhancedPrompt = enhancePrompt(prompt);

  const encoded = encodeURIComponent(enhancedPrompt);
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed),
    nologo: "true",
    model: options?.model ?? "flux",
  });

  const url = `${POLLINATIONS_BASE}/${encoded}?${params.toString()}`;

  // Verify the image is accessible (HEAD request with timeout)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      // If HEAD fails, the URL may still work (some CDNs don't support HEAD)
      console.warn("[imagegen] HEAD check failed, URL may still work:", res.status);
    }
  } catch {
    // Timeout or network error — URL is still valid, Pollinations may just be slow
    console.warn("[imagegen] HEAD check timed out, proceeding with URL");
  }

  return {
    url,
    prompt: enhancedPrompt,
    width,
    height,
    latencyMs: Date.now() - start,
  };
}

/**
 * Enhance a user prompt into a better image generation prompt.
 * Adds quality/style keywords for more consistent, higher-quality results.
 */
function enhancePrompt(userPrompt: string): string {
  const lower = userPrompt.toLowerCase();

  // If user already specified style cues, use as-is
  if (/(?:photo|realistic|real|photograph|cinematic|35mm|8k|hdr)/i.test(userPrompt)) {
    return userPrompt;
  }

  // If user asked for specific styles
  if (/(?:logo|icon|minimal|flat|vector)/i.test(lower)) {
    return `${userPrompt}, professional design, clean background, high quality`;
  }

  if (/(?:illustration|drawing|sketch|art|painting)/i.test(lower)) {
    return `${userPrompt}, detailed digital art, high quality, vibrant colors`;
  }

  if (/(?:website|ui|interface|app|dashboard)/i.test(lower)) {
    return `${userPrompt}, modern UI design, clean layout, professional, high quality`;
  }

  // Default: photorealistic enhancement
  return `${userPrompt}, high quality, detailed, professional photography, sharp focus, good lighting`;
}

/**
 * Generate multiple image variations from a prompt.
 */
export async function generateImageVariations(
  prompt: string,
  count: number = 2,
): Promise<ImageGenResult[]> {
  const results: ImageGenResult[] = [];
  // Stagger seeds for variety
  const baseSeed = Math.floor(Math.random() * 900000);

  for (let i = 0; i < count; i++) {
    try {
      const result = await generateImage(prompt, {
        seed: baseSeed + i,
        width: 1024,
        height: 1024,
      });
      results.push(result);
    } catch (err) {
      console.error(`[imagegen] variation ${i + 1} failed:`, err);
    }
  }

  return results;
}
