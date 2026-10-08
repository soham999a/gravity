/**
 * Firestore resilience guard.
 *
 * Problem: when Firestore quota is exhausted (RESOURCE_EXHAUSTED) the gRPC
 * client retries with backoff, so EVERY Firestore op hangs ~20s before the
 * existing try/catch fallback to in-memory kicks in. Every poll hammers the
 * dead quota further, delaying its recovery.
 *
 * Fix (three layers):
 * 1. `fs()` — races every Firestore op against a timeout (default 5s) so we
 *    fall back to in-memory fast instead of hanging the request.
 * 2. Circuit breaker — after 3 consecutive failures Firestore is skipped
 *    entirely for 5 minutes (all reads/writes go to memory instantly).
 *    A later success closes the breaker immediately.
 * 3. `FIRESTORE_DISABLED=1` env — hard escape hatch for local testing.
 */

const OP_TIMEOUT_MS = Number(process.env.FIRESTORE_OP_TIMEOUT_MS ?? 5000);
const TRIP_AFTER_FAILURES = 3;
const COOLDOWN_MS = 5 * 60_000;

let consecutiveFailures = 0;
let coolUntil = 0;

export function dbAllowed(): boolean {
  if (process.env.FIRESTORE_DISABLED === "1") return false;
  return Date.now() >= coolUntil;
}

function recordSuccess(): void {
  consecutiveFailures = 0;
  coolUntil = 0;
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= TRIP_AFTER_FAILURES) {
    coolUntil = Date.now() + COOLDOWN_MS;
    console.warn(
      `[db-guard] Firestore breaker OPEN for ${COOLDOWN_MS / 60000}min after ${consecutiveFailures} failures — in-memory mode.`,
    );
  }
}

/**
 * Run a Firestore op with a fail-fast timeout. Resolves with the op result;
 * on timeout or error records a breaker failure and rethrows the ORIGINAL
 * error so existing catch-and-fallback blocks behave unchanged.
 */
export async function fs<T>(op: () => Promise<T>, timeoutMs = OP_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("firestore-op-timeout")), timeoutMs);
  });
  try {
    const result = await Promise.race([op(), timeout]);
    recordSuccess();
    return result;
  } catch (err) {
    recordFailure();
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Tenant cache — verifyAuthToken hits Firestore on EVERY request (each poll
// tick!). Cache uid → tenantId for 10 minutes after a successful provision.
// ---------------------------------------------------------------------------

const TENANT_TTL_MS = 10 * 60_000;
const tenantCache = new Map<string, { tenantId: string; exp: number }>();

export function cachedTenant(uid: string): string | null {
  const hit = tenantCache.get(uid);
  if (hit && hit.exp > Date.now()) return hit.tenantId;
  if (hit) tenantCache.delete(uid);
  return null;
}

export function storeTenant(uid: string, tenantId: string): void {
  tenantCache.set(uid, { tenantId, exp: Date.now() + TENANT_TTL_MS });
}
