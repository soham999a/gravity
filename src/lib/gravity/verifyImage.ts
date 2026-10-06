/**
 * Image Verification — the senior's 4th capability box.
 *
 *   Reasoning ≠ Image Generation ≠ Vision ≠ **Image Verification**
 *
 * After an image is generated, a SEPARATE vision-capable model looks at the
 * actual image bytes and judges whether it matches what the user asked for.
 * The generator never grades its own homework.
 *
 * Never throws — verification failure degrades to `skipped` so a flaky
 * vision call can't kill an otherwise-successful mission.
 */

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface ImageVerification {
  /** Did the verification pipeline actually run (vs. skipped)? */
  verified: boolean;
  /** Vision model's verdict: does the image match the prompt? */
  matches: boolean | null;
  /** Model confidence 0-1 in its own verdict */
  confidence: number | null;
  /** One-sentence explanation from the vision model */
  feedback: string;
  /** Which vision model performed the check */
  model: string | null;
  /** Why verification was skipped, if it was */
  reason?: string;
  /** ms spent verifying */
  latencyMs: number;
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

function safeJson<T>(text: string): T | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Download the generated image and return base64 + mime type. */
async function fetchImageBytes(
  url: string,
): Promise<{ base64: string; mimeType: string } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": "GravityPro/1.0 (image verification)" },
      });
      if (!res.ok) {
        // Pollinations generates lazily on first request; a 5xx may mean
        // "still cooking", and 402 is a transient burst throttle (verified:
        // a later attempt succeeds) — retry once after a short wait.
        if (attempt === 0 && (res.status >= 500 || res.status === 402)) {
          await new Promise((r) => setTimeout(r, 5_000));
          continue;
        }
        return null;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 1_000) {
        // Suspiciously small — likely an error placeholder, retry once.
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 4_000));
          continue;
        }
        return null;
      }
      const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      return { base64: buffer.toString("base64"), mimeType };
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 4_000));
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Warm up an image URL: Pollinations generates lazily on first request, so a
 * fresh seed can 5xx while it's still cooking — and its anonymous tier emits
 * transient 402 (burst-throttle) responses that succeed on a later try.
 * Kick the URL now (with retries) so the image is ready when the browser or
 * the vision verifier asks for it.
 * Fire-and-forget safe — never blocks indefinitely or throws.
 */
export async function warmupImage(
  url: string,
  opts?: { notAfter?: number },
): Promise<void> {
  if (!url) return;
  const notAfter = opts?.notAfter;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (notAfter !== undefined && Date.now() > notAfter) return;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { "User-Agent": "GravityPro/1.0 (image warmup)" },
      });
      if (res.ok) {
        // Drain a chunk so the CDN fully materializes the render.
        await res.arrayBuffer();
        return;
      }
      // Retryable: 5xx (still cooking) and 402 (transient burst throttle —
      // probe-verified that a later attempt succeeds). Everything else: stop.
      if (res.status >= 500 || res.status === 402) {
        await new Promise((r) => setTimeout(r, 4_000));
        continue;
      }
      return; // 4xx (other) — retrying won't help
    } catch {
      if (notAfter !== undefined && Date.now() > notAfter) return;
      await new Promise((r) => setTimeout(r, 4_000));
    }
  }
}

/**
 * Verify a generated image against the original user prompt using a
 * vision-capable model (Gemini 2.5 Flash — distinct from the generator).
 *
 * `expectOverlayText`: when the plan moved words into an HTML/CSS overlay,
 * the AI background intentionally contains NO text — the verifier must not
 * fail it for missing (or ignore garbled) lettering.
 */
export async function verifyImage(
  imageUrl: string,
  originalPrompt: string,
  opts?: { expectOverlayText?: boolean },
): Promise<ImageVerification> {
  const started = Date.now();
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!process.env.GEMINI_API_KEY) {
    return {
      verified: false,
      matches: null,
      confidence: null,
      feedback: "No vision model configured — verification skipped.",
      model: null,
      reason: "no_vision_model",
      latencyMs: 0,
    };
  }

  const image = await fetchImageBytes(imageUrl);
  if (!image) {
    return {
      verified: false,
      matches: null,
      confidence: null,
      feedback: "Could not download the generated image — verification skipped.",
      model: null,
      reason: "image_fetch_failed",
      latencyMs: Date.now() - started,
    };
  }

  try {
    const parts: GeminiPart[] = [
      {
        inline_data: { mime_type: image.mimeType, data: image.base64 },
      },
      {
        text:
          "You are an image verification engine. Look at this generated image and judge " +
          "whether it faithfully matches the user's request. Reply ONLY with JSON: " +
          '{"matches":true|false,"confidence":0.0-1.0,"feedback":"one decisive sentence"} . ' +
          "Judge subject adherence (the requested subject is present), style match if specified, " +
          "and absence of obvious rendering defects. Minor artistic licence is acceptable." +
          (opts?.expectOverlayText
            ? " The user's text/typography is added later as a separate overlay layer — the image is EXPECTED to contain no lettering, so do NOT penalize missing text, garbled text, or lettering-like artifacts; reserve clean negative space for the overlay is CORRECT."
            : ""),
      },
      {
        text: `USER REQUEST: ${originalPrompt.slice(0, 600)}`,
      },
    ];

    const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        verified: false,
        matches: null,
        confidence: null,
        feedback: `Vision model error ${res.status}: ${errText.slice(0, 120)}`,
        model,
        reason: "vision_model_error",
        latencyMs: Date.now() - started,
      };
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = safeJson<{ matches?: boolean; confidence?: number; feedback?: string }>(text);

    if (!parsed || typeof parsed.matches !== "boolean") {
      return {
        verified: false,
        matches: null,
        confidence: null,
        feedback: "Vision model returned an unparseable verdict — verification skipped.",
        model,
        reason: "unparseable_verdict",
        latencyMs: Date.now() - started,
      };
    }

    return {
      verified: true,
      matches: parsed.matches,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      feedback: String(parsed.feedback ?? "").slice(0, 300),
      model,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      verified: false,
      matches: null,
      confidence: null,
      feedback: `Verification failed: ${String(err).slice(0, 150)}`,
      model,
      reason: "exception",
      latencyMs: Date.now() - started,
    };
  }
}
