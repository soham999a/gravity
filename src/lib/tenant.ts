/**
 * Tenant resolution — now handled via Firestore through api-auth.ts.
 * This file is kept for backward compatibility but delegates to Firestore.
 */

import { verifyAuthToken } from "./api-auth";
import type { NextRequest } from "next/server";

export interface AuthContext {
  authUserId: string;
  email: string;
  name: string;
  tenantId: string;
}

/**
 * Resolve the authenticated session into an app tenant context.
 * Uses Firebase Auth + Firestore (via api-auth).
 */
export async function getAuthContext(request?: NextRequest): Promise<AuthContext | null> {
  if (!request) return null;
  const ctx = await verifyAuthToken(request);
  if (!ctx) return null;
  return {
    authUserId: ctx.uid,
    email: ctx.email,
    name: ctx.name ?? ctx.email,
    tenantId: ctx.tenantId,
  };
}
