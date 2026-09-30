/**
 * One-shot live verification of the two new provider keys.
 * Minimal token spend: ~20 output tokens on free/cheapest paths.
 */
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

async function main() {
  // ── OpenRouter: key validity + credit ──
  const keyRes = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
  });
  const keyData = await keyRes.json().catch(() => ({}));
  console.log("── OpenRouter key check:", keyRes.status);
  if (keyData?.data) {
    console.log("   label:", keyData.data.label, "| usage: $" + (keyData.data.usage ?? 0), "| limit:", keyData.data.limit ?? "none (payg)");
  }

  // ── OpenRouter: find a free model and fire a tiny completion ──
  const modelsRes = await fetch("https://openrouter.ai/api/v1/models");
  const modelsData = await modelsRes.json().catch(() => ({ data: [] }));
  const freeIds = (modelsData.data ?? [])
    .map((m) => m.id)
    .filter((id) => id.endsWith(":free"));
  console.log("   free models available:", freeIds.length, freeIds.slice(0, 5));
  const freeModel = freeIds.find((id) => id.includes("deepseek")) ?? freeIds[0];

  if (freeModel) {
    const t0 = Date.now();
    const chatRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gravity.matrka.net",
        "X-Title": "GRAVITY",
      },
      body: JSON.stringify({
        model: freeModel,
        messages: [{ role: "user", content: "Reply with exactly: GRAVITY LINK OK" }],
        max_tokens: 20,
      }),
    });
    const chat = await chatRes.json().catch(() => ({}));
    const text = chat?.choices?.[0]?.message?.content?.trim();
    console.log(`   completion via ${freeModel}:`, chatRes.status, "|", text ? `"${text.slice(0, 40)}"` : JSON.stringify(chat).slice(0, 160), `| ${Date.now() - t0}ms`);
    console.log("   served model:", chat?.model ?? "?", "| usage:", JSON.stringify(chat?.usage ?? {}));
  }

  // ── DeepSeek: balance + tiny completion ──
  const balRes = await fetch("https://api.deepseek.com/user/balance", {
    headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` },
  });
  const bal = await balRes.json().catch(() => ({}));
  console.log("── DeepSeek key check:", balRes.status, "| balance:", JSON.stringify(bal ?? {}));

  const dsRes = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "Reply with exactly: GRAVITY DS OK" }],
      max_tokens: 20,
    }),
  });
  const ds = await dsRes.json().catch(() => ({}));
  const dsText = ds?.choices?.[0]?.message?.content?.trim();
  console.log("   completion:", dsRes.status, "|", dsText ? `"${dsText.slice(0, 40)}"` : JSON.stringify(ds).slice(0, 200));
  console.log("   usage:", JSON.stringify(ds?.usage ?? {}));
}

main().catch((err) => {
  console.error("verify failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
