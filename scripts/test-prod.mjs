// node scripts/test-prod.mjs — zero-dep prod-guard tests for localhost.
import assert from "node:assert";

const base = process.env.TEST_BASE ?? "http://localhost:3000";

async function get(path) {
  const res = await fetch(`${base}${path}`);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

// 1. health endpoint shape
{
  const { res, json } = await get("/api/health");
  assert.equal(res.status, 200, "health 200");
  assert.equal(json.ok, true, "health ok");
  assert.ok("firebaseReady" in json, "health firebaseReady");
  assert.ok("llmConfigured" in json, "health llmConfigured");
  console.log("✓ health", json);
}

// 2. authed APIs fail closed without cookie
{
  const { res } = await get("/api/missions");
  assert.equal(res.status, 401, "missions 401 without auth");
  console.log("✓ missions 401 without cookie");
}

// 3. session rejects empty token
{
  const res = await fetch(`${base}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400, "session 400 on empty");
  console.log("✓ session 400 on empty token");
}

// 4. security headers present
{
  const res = await fetch(`${base}/`);
  assert.equal(res.headers.get("x-frame-options"), "DENY", "X-Frame DENY");
  assert.ok(res.headers.get("referrer-policy"), "referrer-policy");
  console.log("✓ security headers");
}

console.log("ALL PROD TESTS PASSED");
