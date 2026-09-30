/**
 * One-shot live probe of the CodeCraft API key (cc_...).
 * Checks: key validity, model list, tiny completion, silent-swap guard.
 */
const KEY = process.env.CODECRAFT_API_KEY;
const BASE = "https://codecraftapi.com/v1";

async function main() {
  const modelsRes = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  console.log("── /models:", modelsRes.status);
  const models = await modelsRes.json().catch(() => ({}));
  const ids = (models.data ?? []).map((m) => m.id ?? m);
  console.log("   models:", ids.length);
  for (const id of ids.slice(0, 40)) console.log("   ·", id);

  // Pick their headline model first, fall back to whatever exists.
  const pick =
    ids.find((id) => /claude-opus/i.test(id)) ??
    ids.find((id) => /claude/i.test(id)) ??
    ids[0];
  if (!pick) return console.log("   (no models listed — free plan may gate listing)");

  const t0 = Date.now();
  const chatRes = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: pick,
      messages: [{ role: "user", content: "Reply with exactly: GRAVITY CC OK" }],
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
