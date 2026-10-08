import { NextResponse } from "next/server";
import { verifyAuthToken, isStoreUnavailable, storeUnavailableResponse } from "@/lib/api-auth";
import { createMission, listMissions } from "@/lib/db-firestore";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createMissionWithPlan, failStaleMissions } from "@/lib/gravity/pipeline";

export const dynamic = "force-dynamic";

// The vercel cron for stale missions only fires daily (Hobby-plan limit), so
// sweep orphaned runs opportunistically here — at most once a minute per
// instance — keeping the home feed statuses honest.
let lastStaleSweep = 0;

interface CsvFile {
  data: string;
  name: string;
}

export async function GET(request: Request) {
  try {
    let ctx;
    try {
      ctx = await verifyAuthToken(request as any);
    } catch (err) {
      if (isStoreUnavailable(err)) return storeUnavailableResponse();
      throw err;
    }
    if (!ctx) {
      return NextResponse.json({ error: "unauthenticated", live: false }, { status: 401 });
    }
    const now = Date.now();
    if (now - lastStaleSweep > 60_000) {
      lastStaleSweep = now;
      await failStaleMissions().catch(() => {});
    }
    const rows = await listMissions(ctx.tenantId);
    return NextResponse.json({ missions: rows, live: true });
  } catch (err) {
    console.error("[api/missions] GET error:", err);
    return NextResponse.json({ missions: [], live: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let ctx;
    try {
      ctx = await verifyAuthToken(request as any);
    } catch (err) {
      if (isStoreUnavailable(err)) return storeUnavailableResponse();
      throw err;
    }
    if (!ctx) {
      return NextResponse.json({ error: "unauthenticated", live: false }, { status: 401 });
    }

    const body = (await request.json()) as {
      prompt?: string;
      files?: CsvFile[];
      forceStrategy?: string;
      imageModel?: string;
    };
    let prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (prompt.length > 4000) {
      return NextResponse.json({ error: "prompt exceeds 4000 characters" }, { status: 413 });
    }
    try {
      const { sanitizePrompt, sanitizeFileName, validateCsv, FREE_MONTHLY_TOKENS } =
        await import("@/lib/validate");
      prompt = sanitizePrompt(prompt);
      if (body.files) {
        if (body.files.length > 5) throw new Error("max 5 files");
        for (const f of body.files) {
          validateCsv(f.data);
          f.name = sanitizeFileName(f.name);
        }
      }
      // Server-side monthly token budget (client meter is display-only).
      const rows = await listMissions(ctx.tenantId);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const used = rows
        .filter((m) => new Date(m.createdAt).getTime() >= monthStart.getTime())
        .reduce((s, m) => s + (m.totalTokens ?? 0), 0);
      if (used > FREE_MONTHLY_TOKENS && process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "monthly token budget exceeded — upgrade plan" },
          { status: 402 },
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "bad input" },
        { status: 400 },
      );
    }

    // Abuse/cost guard: 20 missions per 10 min per user/IP.
    const rl = checkRateLimit(`missions:${rateLimitKey(request, ctx.uid)}`, 20, 10 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "rate limited — try again in a few minutes" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
      );
    }

    const { mission, profile, routing } = await createMissionWithPlan(prompt, {
      tenantId: ctx.tenantId,
      userId: ctx.uid,
      files: body.files,
      forceStrategy: body.forceStrategy,
      imageModel: body.imageModel,
    });

    return NextResponse.json(
      {
        missionId: mission.id,
        profile,
        routing,
        live: true,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/missions] POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
