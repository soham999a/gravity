import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

function cleanPrivateKey(raw: string | undefined): string {
  if (!raw) return "";
  let key = raw.replace(/^"|"$/g, "");
  key = key.replace(/\\n/g, "\n");
  return key.trim();
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

let adminApp: ReturnType<typeof initializeApp> | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

function getAdminApp() {
  if (adminApp) return adminApp;
  if (!projectId || !clientEmail || !privateKey) {
    console.error("[firebase-admin] Missing credentials — Firestore/Auth unavailable");
    return null;
  }
  try {
    adminApp = getApps().length === 0
      ? initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
          // Needed for paid image uploads (OpenRouter b64 → hosted URL).
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`,
        })
      : getApps()[0]!;
    return adminApp;
  } catch (err) {
    console.error("[firebase-admin] Failed to initialize:", String(err).slice(0, 200));
    return null;
  }
}

export function isFirebaseReady(): boolean {
  return Boolean(getAdminApp());
}

// Lazy getters — never crash at import time
function getDb(): Firestore {
  if (_db) return _db;
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin not configured — check FIREBASE_PRIVATE_KEY env var");
  _db = getFirestore(app);
  return _db;
}

function getAdminAuth(): Auth {
  if (_auth) return _auth;
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin not configured — check FIREBASE_PRIVATE_KEY env var");
  _auth = getAuth(app);
  return _auth;
}

/**
 * Upload buffer → hosted URL for paid image generations (OpenRouter returns
 * base64 bytes, but the pipeline + verifier + UI all speak URLs).
 * Tries the configured bucket, then both Firebase bucket suffixes — a wrong
 * bucket name must not silently downgrade paid renders to free.
 * Throws when Storage is unavailable — callers fall back to Pollinations.
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  dest: string,
  contentType = "image/png",
): Promise<string> {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin not configured — cannot upload image");
  const { getStorage } = await import("firebase-admin/storage");
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const candidates = [
    process.env.FIREBASE_STORAGE_BUCKET,
    app.options?.storageBucket as string | undefined,
    projectId ? `${projectId}.firebasestorage.app` : undefined,
    projectId ? `${projectId}.appspot.com` : undefined,
  ].filter((b): b is string => Boolean(b));
  const tried = [...new Set(candidates)];
  let lastErr: unknown = null;
  for (const bucketName of tried) {
    try {
      const bucket = getStorage(app).bucket(bucketName);
      const file = bucket.file(dest);
      await file.save(buffer, { metadata: { contentType } });
      // Signed URL (30 days) — works without making the bucket public.
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 30 * 24 * 3600 * 1000,
      });
      return url;
    } catch (err) {
      lastErr = err;
      console.warn(`[firebase-admin] upload to ${bucketName} failed, trying next:`, String(err).slice(0, 140));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all Storage buckets failed");
}

// Proxy exports so existing imports work: adminDb.collection(...), adminAuth.verifyIdToken(...)
export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop, _receiver) {
    const db = getDb();
    const val = (db as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof val === "function") {
      return val.bind(db);
    }
    return val;
  },
});

export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop, _receiver) {
    const auth = getAdminAuth();
    const val = (auth as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof val === "function") {
      return val.bind(auth);
    }
    return val;
  },
});
