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
import { cachedTenant, dbAllowed, fs, storeTenant } from "./db-guard";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export interface AuthContext {
  uid: string;
  email: string;
  name: string | null;
  tenantId: string;
}

/** True when verifyAuthToken threw because the token is fine but the
 *  account store (Firestore) is unreachable. Routes map this to 503. */
export function isStoreUnavailable(err: unknown): boolean {
  return err instanceof Error && err.message === "AUTH_STORE_UNAVAILABLE";
}

/** 503 for store outages — retryable, must NOT trigger client re-login. */
export function storeUnavailableResponse() {
  return NextResponse.json(
    { error: "account store temporarily unavailable — try again shortly", retryable: true },
    { status: 503 },
  );
}

const DEFAULT_TENANT = "default";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

async function getOrCreateUser(uid: string, email: string, name: string | null): Promise<string> {
  if (!isFirebaseReady() || !dbAllowed()) return cachedTenant(uid) ?? DEFAULT_TENANT;

  // Tenant cache: auth runs on EVERY request (each poll tick) — don't burn
  // a Firestore read per request for an already-provisioned user.
  const hit = cachedTenant(uid);
  if (hit) return hit;

  try {
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await fs(() => userRef.get());

    if (userSnap.exists) {
      const tenantId = userSnap.data()!.tenantId;
      storeTenant(uid, tenantId);
      return tenantId;
    }

    // First request: auto-provision tenant + user
    const slugBase = email
      .split("@")[0]!
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24);
    const slug = `${slugBase}-${uid.slice(0, 8)}`;

    const tenantsSnap = await fs(() =>
      adminDb.collection("tenants").where("slug", "==", slug).limit(1).get(),
    );
    let tenantId: string;

    if (!tenantsSnap.empty) {
      tenantId = tenantsSnap.docs[0]!.id;
    } else {
      const tenantRef = adminDb.collection("tenants").doc();
      tenantId = tenantRef.id;
      await fs(() =>
        tenantRef.set({
          id: tenantId,
          name: `${slugBase}'s workspace`,
          slug,
          createdAt: new Date().toISOString(),
        }),
      );
    }

    await fs(() =>
      userRef.set({
        id: uid,
        tenantId,
        email,
        name: name ?? null,
        role: "owner",
        createdAt: new Date().toISOString(),
      }),
    );

    storeTenant(uid, tenantId);
    return tenantId;
  } catch (err) {
    console.error("[api-auth] Firestore provisioning failed:", String(err).slice(0, 200));
    // Fail closed in production so tenants never silently collapse into "default".
    if (isProduction() && process.env.ALLOW_MEM_FALLBACK !== "1") throw err;
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
      let tenantId: string;
      try {
        tenantId = await getOrCreateUser(uid, email, name);
      } catch {
        // Token is VALID but the account store (Firestore) is unreachable.
        // This is a server outage, not a bad session — throw a typed error
        // so routes answer 503 (retryable) instead of 401 (re-login).
        throw new Error("AUTH_STORE_UNAVAILABLE");
      }
      return { uid, email, name, tenantId };
    } catch (err) {
      if (err instanceof Error && err.message === "AUTH_STORE_UNAVAILABLE") throw err;
      // Fall through to path 2
    }
  }

  // Path 2: Manual JWT decode — DEV ONLY. Production must cryptographically
  // verify via Admin SDK above. Allowing this in prod lets anyone forge fb-token.
  if (isProduction() && process.env.ALLOW_UNSAFE_AUTH !== "1") return null;
  const decoded = decodeFirebaseToken(idToken);
  if (!decoded) return null;

  uid = decoded.uid;
  email = decoded.email;
  name = decoded.name;

  try {
    const tenantId = await getOrCreateUser(uid, email, name);
    return { uid, email, name, tenantId };
  } catch {
    throw new Error("AUTH_STORE_UNAVAILABLE");
  }
}
