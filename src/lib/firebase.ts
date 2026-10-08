import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "demo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "demo.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "0",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "demo-app",
};

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
  }
  return app;
}

function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getApp());
  return _auth;
}

// Eager singleton — safe at import time because firebaseConfig always has
// strings (real env or demo fallback). Keeps `auth` a real Auth instance so
// onAuthStateChanged(auth,…), signInWithEmailAndPassword(auth,…) etc. work
// unchanged, and static prerender (CI / Vercel build workers without env)
// succeeds. Real auth calls fail at runtime, which is the correct place.
export const auth: Auth = getFirebaseAuth();

// Lazy accessor for code that wants it explicitly.
export function firebaseAuth(): Auth {
  return getFirebaseAuth();
}

/**
 * Google sign-in (popup) + session cookie, shared by the login page and the
 * run-gate modal. Requires in Firebase console → Authentication → Sign-in
 * method: Google ENABLED, and the app's domains (Vercel URL + custom domain)
 * listed under Authentication → Settings → Authorized domains.
 */
export async function signInWithGoogle(): Promise<void> {
  const cred = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  const idToken = await cred.user.getIdToken();
  // Server sets HttpOnly fb-token cookie (XSS-safe); keep the document.cookie
  // fallback so a transient session-endpoint failure doesn't strand the user.
  try {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    /* session endpoint unavailable — fallback below */
  }
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `fb-token=${idToken}; path=/; max-age=3600; SameSite=Lax${secure}`;
}

/** Human-readable message for Google popup failures. */
export function googleErrorMessage(err: unknown): string {
  const code = (err as { code?: string }).code;
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request")
    return "Google popup was closed — try again.";
  if (code === "auth/unauthorized-domain")
    return "This domain isn't authorized — add it in Firebase console → Authentication → Settings → Authorized domains.";
  if (code === "auth/account-exists-with-different-credential")
    return "This email already uses password sign-in — sign in with email/password once.";
  if (code === "auth/popup-blocked") return "Popup was blocked by the browser — allow popups and try again.";
  return String(err).slice(0, 200);
}
