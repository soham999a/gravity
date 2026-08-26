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
 * Generate an image from a text prompt.
 * Pollinations returns the image directly as a redirect — no API key needed.
 */
export function generateImageURL(
  prompt: string,
  options?: { width?: number; height?: number; seed?: number },
): ImageGenResult {
  const width = options?.width ?? 1024;
  const height = options?.height ?? 1024;
  const seed = options?.seed ?? Math.floor(Math.random() * 999999);

  const enhancedPrompt = enhancePrompt(prompt);
  const encoded = encodeURIComponent(enhancedPrompt);

  const url = `${POLLINATIONS_BASE}/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

  return { url, prompt: enhancedPrompt, width, height, seed };
}

/**
 * Generate multiple image variations with different seeds.
 */
export function generateImageVariations(
  prompt: string,
  count: number = 2,
): ImageGenResult[] {
  const baseSeed = Math.floor(Math.random() * 900000);
  return Array.from({ length: count }, (_, i) =>
    generateImageURL(prompt, { seed: baseSeed + i, width: 1024, height: 1024 }),
  );
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
