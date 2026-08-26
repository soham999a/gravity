/**
 * Server-side auth helper for API routes.
 * Verifies the Firebase ID token and returns the user context.
 * Auto-provisions user in Firestore on first request.
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

    // Auto-provision user in Firestore on first request
    const { tenantId } = await getOrCreateUser(uid, email, decoded.name ?? null);

    return {
      uid,
      email,
      name: decoded.name ?? null,
      tenantId,
    };
  } catch {
    return null;
  }
}
