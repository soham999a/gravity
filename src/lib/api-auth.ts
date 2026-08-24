import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { getAuthContext, type AuthContext } from "@/lib/tenant";

export type TenantGuard = { ctx: AuthContext; error?: undefined } | { ctx?: undefined; error: NextResponse };

/**
 * Standard guard for tenant-scoped API routes. Returns either the
 * authenticated tenant context or a ready-to-return error response.
 */
export async function requireTenant(): Promise<TenantGuard> {
  if (!isDbConfigured) {
    return {
      error: NextResponse.json({ error: "Database not configured", live: false }, { status: 503 }),
    };
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    return {
      error: NextResponse.json({ error: "unauthenticated", live: false }, { status: 401 }),
    };
  }

  return { ctx };
}
