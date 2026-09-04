---
name: knowledge-add
description: >-
  Add or update a knowledge markdown file (concept / how-to / reference / pattern / pitfall / adr / note)
  in this repository following its frontmatter, placement, and freshness conventions. Use when the user
  wants to record something learned about agent development, promote an inbox note to knowledge, or
  mark an existing knowledge file as outdated. Not for building slides (use slide-make) or for periodic
  freshness review (use knowledge-audit).
---

# knowledge-add

knowledge/ inbox/ adr/ に markdown を追加・更新する手順。規約は .claude/rules/ の 3 ファイルが正。

## 手順

1. **書かないものを確認する。** 業務由来の知見 (顧客名、社内固有名詞、案件内容) は書かない。含まれていたら一般化するか、書くのをやめる。

2. **type と置き場所を決める。** 迷ったら次の順で判断する。
   - 「どうやるか」の手順 → `how-to`
   - 「何が起きて何が原因か」→ `pitfall`
   - 「課題と解決の組」→ `pattern`
   - 「一覧・仕様」→ `reference`
   - 「それは何か・なぜか」→ `concept`
   - このリポジトリ自身の運用の決定 → `adr` (adr/ に連番)
   - まだ検証していない、出典が無い → `note` として inbox/ に置く
   type ごとの粒度は .claude/rules/knowledge-authoring.md の表に従う。タイトルが「〜と〜」になるなら分割する。

3. **雛形をコピーする。** `templates/<type>.md` を `knowledge/<kebab-case>.md` (note なら `inbox/`) にコピーする。ファイル名は ASCII kebab-case の名詞句。

4. **frontmatter を埋める。**
   - `description` に一番時間をかける。英語で、What / Use when / Not for を 2〜4 文。.claude/rules/markdown-frontmatter.md「description の書き方」を読む
   - `tags` は taxonomy.yml の語彙から 2〜4 個。無い語が必要なら taxonomy.yml に追加してから使う (追加は最小限)
   - `keywords` は検索用に 3〜20 個。日本語可。エラーメッセージの断片や別名も入れる
   - `sources` に一次情報の URL。knowledge/ で verified にするなら必須
   - `applies_to` に検証した製品とバージョン (`claude-code@2.1` 形式)
   - `status` は実際に試したなら `verified` + `verified_at` (今日)、そうでなければ `draft`

5. **本文を書く。** 日本語。雛形の見出しを使う。関連する knowledge には相対パスでリンクする。
   図が要るなら、単純なものは mermaid。複雑な構成図は templates/archify/README.md の表から一番近いテンプレートを `knowledge/diagrams/<slug>.<kind>.json` にコピーし、ラベルとカードを差し替えて `pnpm diagrams --check` → `pnpm diagrams` で HTML を作り、本文からリンクする。

6. **既存の知識を置き換える場合。** 古いファイルを上書きせず、新しいファイルを作る。古い方は `status: outdated` にし `superseded_by` に新しい ID を書き、本文冒頭に「この知識は superseded_by の知識により無効」と 1 行加える。

7. **検査する。** `pnpm check` を実行し、error を 0 にする。warning は内容を読んで直せるものは直す。

8. **関連を伝える。** 作成・更新したファイルの ID と、リンクした先を報告する。

## inbox から knowledge への昇格

inbox/ の note を knowledge/ に移すときは、.claude/rules/knowledge-authoring.md「昇格条件」の 5 項目を満たしてから、type を変更し、ファイルを移動し、`pnpm check` を通す。

## 検索

似た知識が既に無いか、先に `pnpm search --text <語>` や `pnpm search --tag <tag>` で確認する。
