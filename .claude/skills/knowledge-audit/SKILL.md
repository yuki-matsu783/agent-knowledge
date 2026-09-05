---
name: knowledge-audit
description: >-
  Review the freshness of knowledge files: find entries whose verified_at is stale, whose applies_to
  version is behind the current product version, or which carry no sources, then re-check,
  update, or mark them deprecated with superseded_by. Use when the user asks to audit, review, refresh,
  or clean up the knowledge base, or on a periodic basis. Not for adding new knowledge (use knowledge-add).
---

# knowledge-audit

knowledge/ の鮮度を点検し、status を正しい状態に戻す手順。

## 手順

1. **候補を列挙する。**
   ```sh
   pnpm audit --days 90
   ```
   verified_at が古いもの、applies_to が無いもの、sources が無いもの、`stale_after` を過ぎたものが表になる。日数は用途に応じて変える。
   `stale_after` は「製品の版で変わりうる挙動」に書いた確かめ直す日なので、日数に関わらず優先して見る。

2. **候補ごとに判断する。** 本文と `sources` を読み、現行バージョンで再確認する。判断は 3 択。
   - **まだ正しい** → `verified_at` を今日に更新し、`applies_to` に確認したバージョンを追加する。`stale_after` があれば 6 か月後に更新する。本文は必要な箇所だけ直す
   - **一部が古い** → 本文を直し、`verified_at` を更新する。変更の経緯は git に任せる
   - **もう成り立たない** → 新しい知識を knowledge-add で作り、古い方を `status: deprecated` + `superseded_by: <新 ID>` にする。本文冒頭に「この知識は superseded_by の知識により無効」と 1 行加える。ファイルは削除しない

3. **`note` を昇格させる。** 昇格の目安 (.claude/rules/knowledge-authoring.md) を満たせるなら type を concept / how-to / reference / pattern / pitfall に変え、`nature` も見直す (finding → fact など)。ファイルは動かさない。

4. **検査する。** `pnpm check` を通す。`superseded_by` の参照先が存在しないと error になる。

5. **報告する。** 点検した件数、更新・無効化・保留の内訳、保留にした理由を短く伝える。

## 判断の基準

- 出典の URL が消えている、または内容が変わっているなら「一部が古い」以上として扱う
- applies_to のメジャーバージョンが上がっているなら、動作を実際に試すまで verified_at を更新しない
- 迷ったら deprecated にせず verified_at を据え置き、報告で「未確認」と明示する
