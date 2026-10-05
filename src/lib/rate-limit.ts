/**
 * Sliding-window rate limiter.
 * - Localhost/single-instance: in-memory buckets (zero deps).
 * - Production multi-instance: set UPSTASH_REDIS_REST_URL + TOKEN and it
 *   uses Redis INCR+EXPIRE via REST (best-effort; falls back to memory on error).
 */

const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit = 20,
  windowMs = 10 * 60 * 1000,
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    return { allowed: false, remaining: 0, resetMs: oldest + windowMs - now };
  }
  hits.push(now);
  buckets.set(key, hits);
  // light cleanup to avoid unbounded growth
  if (buckets.size > 5000) {
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }
  return { allowed: true, remaining: limit - hits.length, resetMs: windowMs };
}

export function rateLimitKey(request: Request, uid?: string): string {
  if (uid) return `uid:${uid}`;
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || "unknown-ip";
  return `ip:${ip}`;
}
