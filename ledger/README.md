# ledger/ — 観測台帳

## いま（Phase 0）
本物の append-only 台帳（1イベント1行のJSONL）は、書き込み先（サーバ）が要る。
Phase 0 では無料・静的のまま回すため、台帳の最小版を次の2つで代替する:

- **共有・挑戦・リファラルのイベント** → GoatCounter のカスタムイベント（`battle/...`, `share/...`, `referral/landed`）
- **ユーザー個人の変遷ログ** → 端末内 localStorage（`um_ledger_v1`）。プライベートで、入力はブラウザの外に出ない。

これで「セッションあたり共有率」と、おおよその K（バイラル係数）の分子・分母が取れる。

## あとで（Phase 1〜2）
シェアの信号が出てきたら、ここを本物の append-only 台帳に差し替える:

- 受け口を1つ立てる（Cloudflare Workers + KV / D1、または任意のログ収集エンドポイント。無料枠で足りる）。
- スキーマは観測OS / Fathom と同じ思想: **生イベントは不変、スコアは上に乗る再計算可能なビュー、各行に provenance**。
- イベント型（最小）: `kokuin_created` / `deck_selected` / `read_generated` / `read_shared` / `referral_landed` / `referral_converted`。

芯（生ログ不変・スコアは飾り）は Phase が進んでも変えない。受け口が変わるだけ。
