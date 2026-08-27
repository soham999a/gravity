import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, string> = {};

  try {
    const m = await import("@/lib/api-auth");
    results["api-auth"] = "OK: " + Object.keys(m).join(", ");
  } catch (e: any) {
    results["api-auth"] = "FAIL: " + e.message?.slice(0, 200);
  }

  try {
    const m = await import("@/lib/firebase-admin");
    results["firebase-admin"] = "OK: " + Object.keys(m).join(", ");
  } catch (e: any) {
    results["firebase-admin"] = "FAIL: " + e.message?.slice(0, 200);
  }

  try {
    const m = await import("@/lib/db-firestore");
    results["db-firestore"] = "OK: " + Object.keys(m).join(", ");
  } catch (e: any) {
    results["db-firestore"] = "FAIL: " + e.message?.slice(0, 200);
  }

  try {
    const m = await import("@/lib/gravity/llm");
    results["llm"] = "OK: " + Object.keys(m).join(", ");
  } catch (e: any) {
    results["llm"] = "FAIL: " + e.message?.slice(0, 200);
  }

  try {
    const m = await import("@/lib/gravity/stats");
    results["stats"] = "OK: " + Object.keys(m).join(", ");
  } catch (e: any) {
    results["stats"] = "FAIL: " + e.message?.slice(0, 200);
  }

  try {
    const m = await import("@/lib/gravity/imagegen");
    results["imagegen"] = "OK: " + Object.keys(m).join(", ");
  } catch (e: any) {
    results["imagegen"] = "FAIL: " + e.message?.slice(0, 200);
  }

  try {
    const m = await import("@/lib/gravity/sitegen");
    results["sitegen"] = "OK: " + Object.keys(m).join(", ");
  } catch (e: any) {
    results["sitegen"] = "FAIL: " + e.message?.slice(0, 200);
  }

  try {
    const m = await import("@/lib/gravity/pipeline");
    results["pipeline"] = "OK: " + Object.keys(m).join(", ");
  } catch (e: any) {
    results["pipeline"] = "FAIL: " + e.message?.slice(0, 200);
  }

  return NextResponse.json(results);
}
