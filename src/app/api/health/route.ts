import { NextResponse } from "next/server";
import { isFirebaseReady } from "@/lib/firebase-admin";
import { isLLMConfigured } from "@/lib/gravity/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  const firebase = (() => {
    try {
      return isFirebaseReady();
    } catch {
      return false;
    }
  })();

  const body = {
    ok: true,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV ?? "development",
    firebaseReady: firebase,
    llmConfigured: isLLMConfigured(),
    strictDb: process.env.NODE_ENV === "production" && process.env.ALLOW_MEM_FALLBACK !== "1",
  };

  // 200 even when deps are down so uptime monitors can parse JSON.
  // Use body.firebaseReady / llmConfigured for alerting.
  return NextResponse.json(body);
}
