import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import {
  planImagePrompts,
  generateImageURL,
} from "@/lib/gravity/imagegen";
import { warmupImage } from "@/lib/gravity/verifyImage";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface RefineBody {
  /** Current render prompt (the one that produced the original image). */
  prompt?: string;
  /** Free-text nudge, e.g. "warmer colors", "more minimal". */
  nudge?: string;
  /** Seed of the original render — kept stable for coherent edits. */
  seed?: number;
  width?: number;
  height?: number;
}

/**
 * POST /api/image/refine — seed-stable iterative image editing.
 *
 * ChatGPT-style "make it warmer / more minimal" nudges: the same base seed
 * is reused so the composition stays coherent, while the free LLM folds the
 * nudge into the render prompt. Free stack only (Pollinations + configured
 * LLM); nothing is persisted — the returned URL is a deterministic
 * Pollinations render the CDN caches.
 */
export async function POST(request: Request) {
  const ctx = await verifyAuthToken(request as any);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { checkRateLimit, rateLimitKey } = await import("@/lib/rate-limit");
  const rl = checkRateLimit(`image-refine:${rateLimitKey(request, ctx.uid)}`, 12, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "refine rate limited — 12 per 10 minutes" },
      { status: 429 },
    );
  }

  let body: RefineBody;
  try {
    body = (await request.json()) as RefineBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const basePrompt = String(body.prompt ?? "").trim();
  const nudge = String(body.nudge ?? "").trim().slice(0, 200);
  if (!basePrompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!nudge) {
    return NextResponse.json({ error: "nudge is required" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9 ,.'\"()&:;!?-]+$/.test(nudge)) {
    return NextResponse.json({ error: "nudge contains unsupported characters" }, { status: 400 });
  }

  // Keep the plan's overlay if the original had one (the nudge shouldn't
  // silently drop the poster title), but don't re-plan from scratch — the
  // user is editing, not re-briefing.
  const width = clampInt(body.width, 256, 1536, 1024);
  const height = clampInt(body.height, 256, 1536, 1024);
  const seed =
    Number.isFinite(body.seed) && Number(body.seed) >= 0
      ? Math.floor(Number(body.seed))
      : Math.floor(Math.random() * 900_000);

  const plan = await planImagePrompts(`${basePrompt}. Style adjustment: ${nudge}`, {
    budgetMs: 10_000,
  });

  // Stable seed = coherent composition; nudge lives only in the prompt.
  const gen = generateImageURL(plan.imagePrompt, { seed, width, height });
  // Warm it so the UI shows a finished image instead of "still rendering".
  void warmupImage(gen.url).catch(() => {});

  return NextResponse.json({
    ok: true,
    image: {
      url: gen.url,
      prompt: gen.prompt,
      width: gen.width,
      height: gen.height,
      seed: gen.seed,
    },
    overlay: plan.overlay,
    refined: true,
  });
}

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}
