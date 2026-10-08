"use client";

import { auth } from "./firebase";

/**
 * One-shot session healer for 401s.
 *
 * Firebase ID tokens expire after 1 hour. AuthCookieSync refreshes the
 * fb-token cookie proactively, but a suspended/backgrounded tab can still
 * miss the rotation — then every /api/* poll starts 401ing. Instead of
 * forcing a manual re-login, callers (mission feed, run poller) call this
 * once on 401: it force-refreshes the Firebase token, re-issues the
 * server cookie via /api/auth/session, and reports whether the retry is
 * worth attempting.
 *
 * Throttled (60s) and deduped so 5s poll loops can't burn Firebase
 * refresh quota while the session is genuinely dead (signed out).
 */

let inFlight: Promise<boolean> | null = null;
let lastAttempt = 0;

async function doRefresh(): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    const token = await user.getIdToken(true);
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;
  if (Date.now() - lastAttempt < 60_000) return Promise.resolve(false);
  lastAttempt = Date.now();
  inFlight = doRefresh().then(
    (ok) => {
      inFlight = null;
      return ok;
    },
    () => {
      inFlight = null;
      return false;
    },
  );
  return inFlight;
}
