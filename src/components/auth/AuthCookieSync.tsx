"use client";

import { useEffect } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
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
 *
 * Two hardening additions:
 * - Proactive refresh: onIdTokenChanged does NOT fire while the tab is
 *   suspended/backgrounded, so an idle-over-an-hour tab still wakes up to
 *   401s. A 45-minute interval force-refreshes the token while signed in.
 * - No duplicate cookies: when the server POST succeeds its HttpOnly
 *   cookie is authoritative — the JS fallback cookie is only written when
 *   the server call fails. Two same-name cookies let a stale one shadow
 *   the fresh one server-side.
 */
export function AuthCookieSync() {
  useEffect(() => {
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";

    const pushSession = (token: string) =>
      fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      }).then((res) => {
        if (!res.ok) throw new Error(`session ${res.status}`);
      });

    const fallbackCookie = (token: string) => {
      document.cookie = `fb-token=${token}; path=/; max-age=3600; SameSite=Lax${secure}`;
    };

    const syncUser = (user: User | null, forceRefresh: boolean) => {
      if (!user) {
        document.cookie = `fb-token=; path=/; max-age=0${secure}`;
        return;
      }
      user
        .getIdToken(forceRefresh)
        .then((token) => pushSession(token).catch(() => fallbackCookie(token)))
        .catch(() => {
          /* token unavailable — existing cookie keeps working until expiry */
        });
    };

    const unsubscribe = onIdTokenChanged(auth, (user) => syncUser(user, false));

    // Proactive: covers suspended tabs where the listener never fired.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && auth.currentUser) {
        syncUser(auth.currentUser, true);
      }
    }, 45 * 60_000);

    const onVisible = () => {
      if (document.visibilityState === "visible" && auth.currentUser) {
        auth.currentUser
          .getIdToken(false)
          .then((token) => pushSession(token).catch(() => fallbackCookie(token)))
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
