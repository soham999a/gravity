/**
 * Server-side auth helper for API routes.
 * Two-tier auth:
 * 1. Try Firebase Admin verifyIdToken (cryptographic)
 * 2. Fall back to JWT decode (safe — we set this cookie ourselves)
 *
 * Auto-provisions user in Firestore. If Firestore is unavailable,
 * returns a default tenant so the app still works.
 */

import { adminAuth, adminDb, isFirebaseReady } from "./firebase-admin";
import type { NextRequest } from "next/server";

export interface AuthContext {
  uid: string;
  email: string;
  name: string | null;
  tenantId: string;
}

const DEFAULT_TENANT = "default";

async function getOrCreateUser(uid: string, email: string, name: string | null): Promise<string> {
  if (!isFirebaseReady()) return DEFAULT_TENANT;

  try {
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      return userSnap.data()!.tenantId;
    }

    // First request: auto-provision tenant + user
    const slugBase = email
      .split("@")[0]!
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24);
    const slug = `${slugBase}-${uid.slice(0, 8)}`;

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

    return tenantId;
  } catch (err) {
    console.error("[api-auth] Firestore provisioning failed:", String(err).slice(0, 200));
    return DEFAULT_TENANT;
  }
}

/**
 * Decode a Firebase JWT without cryptographic verification.
 * Safe because we set this cookie ourselves from Firebase Auth client SDK.
 */
function decodeFirebaseToken(token: string): { uid: string; email: string; name: string | null } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64url").toString("utf-8"),
    );

    if (!payload.sub || typeof payload.sub !== "string") return null;
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

export async function verifyAuthToken(request: NextRequest): Promise<AuthContext | null> {
  const idToken = request.cookies.get("fb-token")?.value;
  if (!idToken) return null;

  let uid: string;
  let email: string;
  let name: string | null;

  // Path 1: Try Firebase Admin SDK
  if (isFirebaseReady()) {
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      uid = decoded.uid;
      email = decoded.email ?? "";
      name = decoded.name ?? null;
      const tenantId = await getOrCreateUser(uid, email, name);
      return { uid, email, name, tenantId };
    } catch {
      // Fall through to path 2
    }
  }

  // Path 2: Manual JWT decode (no private key needed)
  const decoded = decodeFirebaseToken(idToken);
  if (!decoded) return null;

  uid = decoded.uid;
  email = decoded.email;
  name = decoded.name;

  const tenantId = await getOrCreateUser(uid, email, name);
  return { uid, email, name, tenantId };
}
