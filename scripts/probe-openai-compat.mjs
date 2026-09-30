/**
 * One-shot live probe for an OpenAI-compatible proxy key.
 * Usage: node scripts/probe-openai-compat.mjs <base-url> <key>
 * Checks: model list, tiny completion, silent-swap guard.
 */
const [, , BASE_RAW, KEY] = process.argv;
if (!BASE_RAW || !KEY) {
  console.error("usage: node scripts/probe-openai-compat.mjs <base-url> <key>");
  process.exit(1);
}
const BASE = BASE_RAW.replace(/\/$/, "");

async function main() {
  const modelsRes = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  console.log("── /models:", modelsRes.status);
  const models = await modelsRes.json().catch(() => ({}));
  const ids = (models.data ?? []).map((m) => m.id ?? m);
  console.log("   models:", ids.length);
  for (const id of ids.slice(0, 40)) console.log("   ·", id);

  const pick =
    ids.find((id) => /claude-opus/i.test(String(id))) ??
    ids.find((id) => /claude/i.test(String(id))) ??
    ids[0];
  if (!pick) return console.log("   (no models listed)");

  const t0 = Date.now();
  const chatRes = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: pick,
      messages: [{ role: "user", content: "Reply with exactly: GRAVITY OK" }],
      max_tokens: 30,
    }),
  });
  const chat = await chatRes.json().catch(() => ({}));
  const text = chat?.choices?.[0]?.message?.content?.trim();
  console.log(`── completion via ${pick}:`, chatRes.status, `| ${Date.now() - t0}ms`);
  console.log("   served model:", chat?.model ?? "?", "| asked:", pick);
  if (chat?.model && chat.model !== pick) console.log("   ⚠ SILENT SWAP DETECTED");
  console.log("   text:", text ? `"${text.slice(0, 60)}"` : JSON.stringify(chat).slice(0, 220));
  console.log("   usage:", JSON.stringify(chat?.usage ?? {}));
}

main().catch((err) => {
  console.error("probe failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
