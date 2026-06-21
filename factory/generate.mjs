/* generate.mjs — 場面テンプレ増殖（Phase 1 / オフライン工場）
   役割: 既存フィールドの voice/values/blindness を踏まえ、blend/clash の場面テンプレ案を追加生成する。
        読みが単調になってきたら回す。出力は「案」。自動でマージしない（運営者が選ぶ）。
   実行: GEMINI_API_KEY=... node generate.mjs shihonshugi 4 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const fieldId = process.argv[2] || "shihonshugi";
const n = Number(process.argv[3] || 4);

if (!API_KEY) {
  console.log(`[generate] GEMINI_API_KEY 未設定。Phase 1 用。鍵を入れて再実行してください。`);
  process.exit(0);
}

const fieldPath = resolve(__dir, `../docs/content/field_${fieldId}.json`);
if (!existsSync(fieldPath)) { console.error(`field_${fieldId}.json が見つかりません`); process.exit(1); }
const field = JSON.parse(readFileSync(fieldPath, "utf8"));

const prompt = `あなたは「未証明の怪物」のフィールド設計者だ。
次のフィールドの世界観に厳密に従って、場面テンプレ案を新しく生成する。

フィールド: ${field.name}
声: ${field.voice}
opening: ${JSON.stringify(field.opening)}
values: ${JSON.stringify(field.values.map(v => v.label))}
rival_says: ${field.rival_says}

不変:
- スコア/ランク/ティアを生成しない。主役は場面。
- テンプレは {opening}{strength}{evidence_field}（blendで）/ {rival_says}（clashで）のスロットを使う。
- 既存と語り口を揃えつつ、表現は重複させない。

blend（馴染んだ場面）を ${n} 個、clash（浮いた場面）を ${n} 個、次の JSON で出力せよ:
{ "blend": ["..."], "clash": ["..."] }
JSON のみ。`;

(async () => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, responseMimeType: "application/json" } }) });
  if (!res.ok) { console.error(`Gemini ${res.status}: ${await res.text()}`); process.exit(1); }
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  console.log("\n=== 場面テンプレ案（レビュー用・自動マージしない） ===\n");
  console.log(raw.replace(/```json|```/g, "").trim());
  console.log("\n→ 良いものだけ field_" + fieldId + ".json の situations に手で足す。critic を通してから採用。");
})();
