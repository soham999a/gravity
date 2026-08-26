/**
 * Server-side auth helper for API routes.
 * Verifies the Firebase ID token and returns the user context.
 */

import { adminAuth, adminDb } from "./firebase-admin";
import type { NextRequest } from "next/server";

export interface AuthContext {
  uid: string;
  email: string;
  name: string | null;
  tenantId: string;
}

/**
 * Extract and verify the Firebase ID token from the request.
 * Returns null if unauthenticated.
 */
export async function verifyAuthToken(request: NextRequest): Promise<AuthContext | null> {
  const idToken = request.cookies.get("fb-token")?.value;
  if (!idToken) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email ?? "";

    // Look up user in Firestore
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) return null;
    const userData = userDoc.data()!;

    return {
      uid,
      email,
      name: userData.name ?? null,
      tenantId: userData.tenantId,
    };
  } catch {
    return null;
  }
}
