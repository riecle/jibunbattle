/* 未証明の怪物 — Phase 0 client engine
   不変: スコアは出さない。読みは入力を引用した「場面」。共有単位も場面。
   LLMは実行時に呼ばない（無料でバズに耐えるため）。読みは authored ルーブリック + 入力をルールで組む。 */

const FIELD_URL = "./content/field_shihonshugi.json";
const DECKS_URL = "./content/decks.json";
const LEDGER_KEY = "um_ledger_v1";

let FIELD = null;
let DECKS = null;
let selectedDeck = null;

/* ---------- utils ---------- */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const trim = (s, n = 40) => { s = String(s || "").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };

/* GoatCounter は任意。未設定でも落ちない。 */
function track(path) {
  try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, event: true }); } catch (e) {}
}

/* ---------- 刻印の収集 ---------- */
function readKokuin() {
  return {
    strengths: [$("#s1").value, $("#s2").value, $("#s3").value].map((v) => v.trim()).filter(Boolean),
    weakness: $("#weakness").value.trim(),
    others_say: $("#others").value.trim(),
    strong_env: $("#strongenv").value.trim(),
    free_text: $("#freetext").value.trim(),
  };
}

/* foreground キー -> 実際の入力値 */
function resolveForeground(key, k) {
  switch (key) {
    case "strength": return k.strengths[0] || "";
    case "weakness": case "weakness_handling": return k.weakness;
    case "others_say": case "ownership": return k.others_say;
    case "strong_env": case "continuity": return k.strong_env;
    case "free_text": return k.free_text;
    default: return "";
  }
}

/* デッキ -> このフィールドで blend か clash か（スコアではなく場面選択にだけ使う） */
function stanceFor(deck, field) {
  const keys = field.values.map((v) => v.key);
  const fit = deck.fit_keys.filter((x) => keys.includes(x)).length;
  const clash = deck.clash_keys.filter((x) => keys.includes(x)).length;
  return clash > fit ? "clash" : "blend";
}

/* デッキごとに、どの盲点へ逃がすか（無ければ回す） */
const DECK_BLIND = { shujinkou: "構想力", hankotsu: "自走性", shokunin: "美意識・文脈理解", survivor: "自走性" };
function chooseBlind(deck, field) {
  const want = DECK_BLIND[deck.id];
  return field.blindness.find((b) => b.label === want) || pick(field.blindness);
}

function fill(tpl, map) {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => (key in map ? map[key] : ""));
}

/* ---------- 読み生成 ---------- */
function generateRead(k, deck, field) {
  const stance = stanceFor(deck, field);
  const fg = deck.foreground.map((key) => resolveForeground(key, k)).filter(Boolean);
  const strength = k.strengths[0] || fg[0] || "（強みが未記入）";
  const evidence = fg.find((v) => v && v !== strength && v !== k.weakness) || k.strong_env || k.others_say || "（具体が未記入）";
  const marginSource = k.free_text || k.strong_env || fg[0] || strength;
  const blind = chooseBlind(deck, field);

  const map = {
    opening: pick(field.opening),
    strength: trim(strength, 60),
    evidence_field: trim(evidence, 60),
    rival_says: field.rival_says,
  };
  const scene = fill(pick(field.situations[stance]), map);

  const margin = fill(field.margin_note, {
    margin_source: trim(marginSource, 50),
    blind_label: blind.label,
    blind_note: blind.note,
    redirect_name: blind.redirect_name,
  });

  const share = fill(field.share_template, {
    deck_name: deck.name,
    verdict_phrase: field.verdict_phrases[stance],
    redirect_name: blind.redirect_name,
  });

  return { stance, scene, margin, share, blind, deck };
}

/* ---------- 描画 ---------- */
function renderRead(r) {
  const out = $("#result");
  out.innerHTML = `
    <article class="seal" aria-live="polite">
      <div class="seal__stamp">資本主義フィールド · ${esc(r.deck.name)}</div>
      <p class="seal__scene">${esc(r.scene)}</p>
      <aside class="seal__margin">
        <span class="seal__margin-label">余白の観測</span>
        ${esc(r.margin)}
      </aside>
      <div class="seal__foot">
        <span class="seal__note">これは判定ではなく観測。価値の宣告ではない。</span>
        <button id="shareBtn" class="btn btn--share">この場面を共有</button>
      </div>
    </article>`;
  $("#shareBtn").addEventListener("click", () => doShare(r));
  out.scrollIntoView({ behavior: "smooth", block: "start" });
  pushLedger(r);
  renderLedger();
}

async function doShare(r) {
  const text = r.share;
  const url = location.origin + location.pathname + "?ref=share";
  track(`share/shihonshugi/${r.deck.id}/${r.stance}`);
  if (navigator.share) {
    try { await navigator.share({ text, url }); return; } catch (e) {}
  }
  const intent = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url);
  window.open(intent, "_blank", "noopener");
}

/* ---------- 変遷ログ（端末内・プライベート） ---------- */
function pushLedger(r) {
  const log = loadLedger();
  log.unshift({ ts: Date.now(), deck: r.deck.name, stance: r.stance, blind: r.blind.label, to: r.blind.redirect_name });
  localStorage.setItem(LEDGER_KEY, JSON.stringify(log.slice(0, 50)));
}
function loadLedger() {
  try { return JSON.parse(localStorage.getItem(LEDGER_KEY) || "[]"); } catch (e) { return []; }
}
function renderLedger() {
  const log = loadLedger();
  const wrap = $("#ledger");
  if (!log.length) { wrap.innerHTML = ""; return; }
  const rows = log.map((e) => {
    const d = new Date(e.ts);
    const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    const verdict = e.stance === "clash" ? "塗りが透けた" : "溶け込んだ";
    return `<li class="ledger__row"><span class="ledger__date">${date}</span><span class="ledger__deck">${esc(e.deck)}</span><span class="ledger__verdict ledger__verdict--${e.stance}">${verdict}</span><span class="ledger__to">→ ${esc(e.to)}</span></li>`;
  }).join("");
  wrap.innerHTML = `<h2 class="ledger__title">変遷ログ</h2><p class="ledger__sub">価値は変わる。それ以上に、見せ方で変わる。</p><ol class="ledger__list">${rows}</ol>`;
}

/* ---------- デッキ選択UI ---------- */
function renderDecks() {
  const wrap = $("#decks");
  wrap.innerHTML = DECKS.decks.map((d) =>
    `<button class="deck" data-id="${d.id}" type="button">
       <span class="deck__name">${esc(d.name)}</span>
       <span class="deck__tag">${esc(d.tagline)}</span>
     </button>`).join("");
  wrap.querySelectorAll(".deck").forEach((btn) => btn.addEventListener("click", () => {
    selectedDeck = DECKS.decks.find((d) => d.id === btn.dataset.id);
    wrap.querySelectorAll(".deck").forEach((b) => b.classList.toggle("deck--on", b === btn));
    $("#submit").disabled = false;
  }));
}

/* ---------- 起動 ---------- */
async function boot() {
  if (new URLSearchParams(location.search).get("ref")) track("referral/landed");
  try {
    [FIELD, DECKS] = await Promise.all([fetch(FIELD_URL).then((r) => r.json()), fetch(DECKS_URL).then((r) => r.json())]);
  } catch (e) {
    $("#result").innerHTML = `<p class="err">コンテンツを読み込めなかった。ローカルで開いた場合は簡易サーバ経由で見てください（READMEのトラブル参照）。GitHub Pages上なら問題なく動きます。</p>`;
    return;
  }
  $("#field-tagline").textContent = FIELD.tagline;
  renderDecks();
  renderLedger();
  $("#submit").addEventListener("click", () => {
    const k = readKokuin();
    if (k.strengths.length === 0) { $("#hint").textContent = "長所を最低1つ刻んでから挑め。"; return; }
    if (!selectedDeck) { $("#hint").textContent = "見せ方デッキを選べ。"; return; }
    $("#hint").textContent = "";
    track(`battle/shihonshugi/${selectedDeck.id}`);
    renderRead(generateRead(k, selectedDeck, FIELD));
  });
}
document.addEventListener("DOMContentLoaded", boot);
