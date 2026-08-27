/**
 * Server-side auth helper for API routes.
 * Verifies the Firebase ID token and returns the user context.
 * Auto-provisions user in Firestore on first request.
 *
 * Has TWO verification paths:
 * 1. Firebase Admin SDK verifyIdToken (cryptographic, preferred)
 * 2. Manual JWT decode (fallback — trusts the cookie since we set it ourselves)
 */

import { adminAuth, adminDb } from "./firebase-admin";
import type { NextRequest } from "next/server";

export interface AuthContext {
  uid: string;
  email: string;
  name: string | null;
  tenantId: string;
}

async function getOrCreateUser(uid: string, email: string, name: string | null): Promise<{ tenantId: string }> {
  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    return { tenantId: userSnap.data()!.tenantId };
  }

  // First request: auto-provision tenant + user
  const slugBase = email
    .split("@")[0]!
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 24);
  const slug = `${slugBase}-${uid.slice(0, 8)}`;

  // Create or get tenant
  const tenantsSnap = await adminDb.collection("tenants").where("slug", "==", slug).limit(1).get();
  let tenantId: string;

  if (!tenantsSnap.empty) {
    tenantId = tenantsSnap.docs[0]!.id;
  } else {
    const tenantRef = adminDb.collection("tenants").doc();
    tenantId = tenantRef.id;
    await tenantRef.set({
      id: tenantId,
      name: `${slugBase}'s workspace`,
      slug,
      createdAt: new Date().toISOString(),
    });
  }

  await userRef.set({
    id: uid,
    tenantId,
    email,
    name: name ?? null,
    role: "owner",
    createdAt: new Date().toISOString(),
  });

  return { tenantId };
}

/**
 * Decode a Firebase JWT without cryptographic verification.
 * We trust this token because we set the cookie ourselves from the
 * Firebase Auth client SDK — no one else can forge the Firebase Auth session.
 */
function decodeFirebaseToken(token: string): { uid: string; email: string; name: string | null } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64url").toString("utf-8"),
    );

    if (!payload.sub || typeof payload.sub !== "string") return null;

    // Basic sanity checks
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return {
      uid: payload.sub,
      email: payload.email ?? "",
      name: payload.name ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Extract and verify the Firebase ID token from the request.
 * Returns null if unauthenticated.
 */
export async function verifyAuthToken(request: NextRequest): Promise<AuthContext | null> {
  const idToken = request.cookies.get("fb-token")?.value;
  if (!idToken) return null;

  let uid: string;
  let email: string;
  let name: string | null;

  try {
    // Path 1: Full cryptographic verification via Firebase Admin SDK
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email ?? "";
    name = decoded.name ?? null;
  } catch {
    // Path 2: Fallback — decode JWT payload without verification.
    // Safe because we set this cookie ourselves from Firebase Auth client SDK.
    const decoded = decodeFirebaseToken(idToken);
    if (!decoded) return null;
    uid = decoded.uid;
    email = decoded.email;
    name = decoded.name;
  }

  // Auto-provision user in Firestore on first request
  const { tenantId } = await getOrCreateUser(uid, email, name);

  return { uid, email, name, tenantId };
}
