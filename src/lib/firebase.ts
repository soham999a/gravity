import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

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
