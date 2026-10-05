/**
 * Minimal structured logger — no new deps.
 * - Redacts secrets / tokens from logs.
 * - console in dev, JSON lines in prod.
 * - Forwards errors to Sentry if SENTRY_DSN is set (plain fetch, no SDK).
 */

function redact(input: string): string {
  return input
    .replace(/(sk-[a-zA-Z0-9-_]{4})[a-zA-Z0-9-_]+/g, "$1…redacted")
    .replace(/(Bearer\s+)[^\s]+/gi, "$1…redacted")
    .replace(/(api[_-]?key["'\s:=]+)[^"'\s,}]+/gi, "$1…redacted")
    .slice(0, 2000);
}

function base(fields: Record<string, unknown>) {
  return { time: new Date().toISOString(), env: process.env.NODE_ENV ?? "dev", ...fields };
}

export const logger = {
  info(msg: string, fields: Record<string, unknown> = {}) {
    console.log(JSON.stringify(base({ level: "info", msg: redact(msg), ...fields })));
  },
  warn(msg: string, fields: Record<string, unknown> = {}) {
    console.warn(JSON.stringify(base({ level: "warn", msg: redact(msg), ...fields })));
  },
  error(msg: string, err?: unknown, fields: Record<string, unknown> = {}) {
    const detail = err instanceof Error ? err.message : String(err ?? "").slice(0, 500);
    console.error(JSON.stringify(base({ level: "error", msg: redact(msg), detail: redact(detail), ...fields })));
    // Fire-and-forget Sentry hook — set SENTRY_DSN to enable.
    const dsn = process.env.SENTRY_DSN;
    if (dsn && detail) {
      fetch(dsn, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg.slice(0, 200), detail: detail.slice(0, 500) }),
      }).catch(() => {});
    }
  },
};
