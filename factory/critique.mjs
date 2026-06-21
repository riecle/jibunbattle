/* critique.mjs — 読みの自動審査（Phase 1 / オフライン工場）
   役割: フィールドの場面テンプレ（または reads.json のバッチ）を read_critic.md で採点し、
        weak率を出し、25%超なら改善提案を起草する。これが防火壁の自動化。
   実行: GEMINI_API_KEY=... node critique.mjs shihonshugi
   鍵が無い場合は手順を表示して安全に終了する。 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash"; // 必要なら GEMINI_MODEL で上書き
const fieldId = process.argv[2] || "shihonshugi";

const SAMPLE = {
  strength: "構造を一瞬で掴むこと",
  evidence: "ルールが未整備な立ち上げを3年回した",
  margin: "完成前のものを形にするのが好き",
};

if (!API_KEY) {
  console.log(`
[critique] GEMINI_API_KEY が未設定です。これは Phase 1（自動審査）用のスクリプトです。
Phase 0 では不要。回したくなったら:
  1. Google AI Studio で無料の API キーを取得
  2. GEMINI_API_KEY=あなたの鍵 node critique.mjs ${fieldId}
`);
  process.exit(0);
}

const critic = readFileSync(resolve(__dir, "prompts/read_critic.md"), "utf8");
const fieldPath = resolve(__dir, `../docs/content/field_${fieldId}.json`);
if (!existsSync(fieldPath)) { console.error(`field_${fieldId}.json が見つかりません`); process.exit(1); }
const field = JSON.parse(readFileSync(fieldPath, "utf8"));

const fill = (t, m) => t.replace(/\{(\w+)\}/g, (_, k) => (k in m ? m[k] : `（${k}）`));

// 審査対象: blend/clash の場面テンプレを実体化したもの
const reads = [];
for (const stance of ["blend", "clash"]) {
  for (const tpl of field.situations[stance]) {
    const scene = fill(tpl, { opening: field.opening[0], strength: SAMPLE.strength, evidence_field: SAMPLE.evidence, rival_says: field.rival_says });
    const blind = field.blindness[0];
    const margin = fill(field.margin_note, { margin_source: SAMPLE.margin, blind_label: blind.label, blind_note: blind.note, redirect_name: blind.redirect_name });
    const share = fill(field.share_template, { deck_name: "主人公型", verdict_phrase: field.verdict_phrases[stance], redirect_name: blind.redirect_name });
    reads.push({ stance, text: `【場面】${scene}\n【余白】${margin}\n【共有】${share}` });
  }
}

async function judge(read) {
  const body = {
    contents: [{ parts: [{ text: `${critic}\n\n---\n## 審査対象の読み\n\n${read.text}` }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

(async () => {
  console.log(`\n=== critique: field_${fieldId} (${reads.length} reads, model=${MODEL}) ===\n`);
  let weak = 0;
  const results = [];
  for (const r of reads) {
    try {
      const j = await judge(r);
      results.push(j);
      if (j.verdict !== "pass") weak++;
      console.log(`[${r.stance}] ${j.verdict.toUpperCase()} (${j.total}/4) — ${j.reason}`);
    } catch (e) {
      console.error(`[${r.stance}] ERROR: ${e.message}`);
    }
  }
  const rate = results.length ? weak / results.length : 0;
  console.log(`\nweak率: ${(rate * 100).toFixed(0)}%  (閾値 25%)`);

  if (rate > 0.25) {
    console.log("\n⚠ weak率が閾値超過。改善提案を起草します…\n");
    const proposalPrompt = `${critic}\n\n以下は ${reads.length} 件の審査結果サマリだ:\n${JSON.stringify(results, null, 2)}\n\nweak率が25%を超えた。read_critic.md の「バッチ集計時」の形式に従って、proposal を1つだけ JSON で出力せよ。`;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: proposalPrompt }] }], generationConfig: { temperature: 0.3, responseMimeType: "application/json" } }) });
      const data = await res.json();
      console.log(data?.candidates?.[0]?.content?.parts?.[0]?.text || "(提案の生成に失敗)");
    } catch (e) { console.error(e.message); }
    console.log("\n→ この提案は自動適用されない。読んで、フィールドを書き換えるか自分で決める。");
  } else {
    console.log("✓ 閾値内。提案なし。");
  }
})();
