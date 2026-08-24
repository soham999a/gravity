import { NextResponse } from "next/server";
import { profileProblem } from "@/lib/gravity/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body?.prompt ?? "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    return NextResponse.json({ profile: profileProblem(prompt), live: true });
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
}
