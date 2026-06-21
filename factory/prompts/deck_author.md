# デッキ著作プロンプト

見せ方デッキを足す・調整するときに LLM へ渡すプロンプト。
出力は `docs/content/decks.json` の `decks` 配列に追記できる JSON。

---

## あなたへの依頼

「未証明の怪物」の見せ方デッキを設計する。
デッキとは「同じ刻印を、どう塗るか」だ。素材（刻印）は同じまま、どの面を前に出し、どんな口調で語るかを変える。これは『めっちゃカメレオン』で体を背景に合わせて塗るのと同じメカニクス——うまく溶けても、透けて見えても、どちらも面白い。

設計するデッキ：〔例：研究者型 / 道化型 / 寡黙型 …自由に〕

---

## 設計の核

- 各デッキには `fit_keys` と `clash_keys` がある。これらはフィールド側の `values[].key` と照合される。
- あるフィールドで `clash_keys` が多くヒットすれば、そのデッキはその場で「浮く」（透けて見える）→ シェアされやすい場面になる。
- `fit_keys` が多くヒットすれば「馴染む」。
- **狙い：全フィールドに馴染むデッキを作らない。** どこかで必ず浮くデッキの方が、コンテンツとして強い。万能デッキは退屈で、現実にも嘘だ。

## よく使われるフィールド value キー（照合先の例）

`conversion`（成果変換） / `ownership`（責任範囲） / `continuity`（継続） / `risk`（リスク選好） / `trust`（信頼） / `aesthetic`（美意識） / `context`（文脈理解） / `adaptation`（変化適応） / `self_drive`（自走）

## 出力スキーマ（1デッキぶん）

```json
{
  "id": "英小文字スラッグ",
  "name": "〇〇型",
  "tagline": "このデッキの戦い方を1文で",
  "foreground": ["前面に出す入力。strength / weakness_handling / others_say / strong_env / free_text / continuity / ownership から2つ"],
  "tone": "measured | expansive | analytical | defiant | understated | gritty | あなたの新語",
  "fit_keys": ["馴染むフィールド価値キー"],
  "clash_keys": ["浮くフィールド価値キー"]
}
```

## 自己チェック

- このデッキは、少なくとも1つのフィールドで「浮く」設計になっているか？
- `foreground` は実在の入力キーだけを使っているか？
- tagline に固有の温度があるか？

JSON のみ出力。
