"use client";

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Keeps the fb-token cookie alive for the whole app.
 *
 * The cookie is normally set once at sign-in with max-age=3600. Firebase ID
 * tokens expire after one hour and rotate silently — without this listener
 * every /api/* call starts returning 401 exactly one hour after login until
 * the user manually signs in again. onIdTokenChanged fires on every token
 * rotation (including the initial sign-in), so the cookie is re-issued with
 * a fresh token well before the old one expires, and cleared on sign-out.
 */
export function AuthCookieSync() {
  useEffect(() => {
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    return onIdTokenChanged(auth, (user) => {
      if (user) {
        user
          .getIdToken()
          .then((token) => {
            // Prefer HttpOnly server cookie; keep JS cookie as dev fallback.
            fetch("/api/auth/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken: token }),
            }).catch(() => {});
            document.cookie = `fb-token=${token}; path=/; max-age=3600; SameSite=Lax${secure}`;
          })
          .catch(() => {
            /* token unavailable — existing cookie keeps working until expiry */
          });
      } else {
        document.cookie = `fb-token=; path=/; max-age=0${secure}`;
      }
    });
  }, []);
  return null;
}
