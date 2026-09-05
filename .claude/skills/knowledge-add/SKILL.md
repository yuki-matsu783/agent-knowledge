---
name: knowledge-add
description: >-
  Add or update a knowledge markdown file (concept / how-to / reference / pattern / pitfall / note)
  in this repository following its frontmatter, placement, and freshness conventions. Use when the user
  wants to record something learned about agent development, promote a note to a firmer type, or
  mark an existing knowledge file as deprecated. Not for building slides (use slide-make) or for periodic
  freshness review (use knowledge-audit).
---

# knowledge-add

knowledge/ に markdown を追加・更新する手順。規約は .claude/rules/ の 3 ファイルが正。

## 手順

1. **書かないものを確認する。** 業務由来の知見 (顧客名、社内固有名詞、案件内容) は書かない。含まれていたら一般化するか、書くのをやめる。

2. **type と置き場所を決める。** 迷ったら次の順で判断する。
   - 「どうやるか」の手順 → `how-to`
   - 「何が起きて何が原因か」→ `pitfall`
   - 「課題と解決の組」→ `pattern`
   - 「一覧・仕様」→ `reference`
   - 「それは何か・なぜか」→ `concept`
   - まだ確かめていない、出典が無い → `note`。置き場所は他と同じ knowledge/
   type ごとの粒度は .claude/rules/knowledge-authoring.md の表に従う。タイトルが「〜と〜」になるなら分割する。
   置き場所は主題ディレクトリ `knowledge/<subject>/`。subject は taxonomy.yml の `subjects` (skill / agent / rule / hook / mcp / model / workflow) から、
   「その知見を活かすとき何を書き換えるか」で 1 つ選ぶ。どれにも収まらない組み合わせは workflow。knowledge/ 直下には置かない (lint が error にする)。

3. **雛形をコピーする。** `templates/<type>.md` を `knowledge/<subject>/<kebab-case>.md` にコピーする。ファイル名は ASCII kebab-case の名詞句。

4. **frontmatter を埋める。**
   - `nature` に知見の性質を 1 つ (fact / finding / insight / heuristic / best-practice / principle / opinion)。判定と title の形は .claude/rules/knowledge-authoring.md「性質 (nature) と title の形」。title の日本語も nature に寄せる
   - `description` に一番時間をかける。英語で、What / Use when / Not for を 2〜4 文。.claude/rules/markdown-frontmatter.md「description の書き方」を読む
   - `tags` は taxonomy.yml の語彙から 2〜4 個。無い語が必要なら taxonomy.yml に追加してから使う (追加は最小限)
   - `keywords` は検索用に 3〜20 個。日本語可。エラーメッセージの断片や別名も入れる
   - `sources` に一次情報の URL。無いと warning が出るが error にはしない
   - `applies_to` に確かめた製品とバージョン (`claude-code@2.1` 形式)。試していないなら書かない
   - `status` は `stable` (書いた時点で現役)。確かめた度合いは status ではなく type と nature が持つ
   - 対策を主題にする知見 (pattern / how-to) には `intervention` (prompt / tool / hook / human) を書く
   - 製品の版で変わりうる挙動 (既定値、UI、hook のフィールド) には `stale_after` (verified_at + 6 か月が目安) を書く

5. **本文を書く。** 日本語。雛形の見出しを使う。関連する knowledge には相対パスでリンクする。
   図が要るなら、単純なものは mermaid。複雑な構成図は templates/archify/README.md の表から一番近いテンプレートを `knowledge/diagrams/<slug>.<kind>.json` にコピーし、ラベルとカードを差し替えて `pnpm diagrams --check` → `pnpm diagrams` で HTML を作り、本文からリンクする。

6. **既存の知識を置き換える場合。** 古いファイルを上書きせず、新しいファイルを作る。古い方は `status: deprecated` にし `superseded_by` に新しい ID を書き、本文冒頭に「この知識は superseded_by の知識により無効」と 1 行加える。

7. **検査する。** `pnpm check` を実行し、error を 0 にする。warning は内容を読んで直せるものは直す。

8. **関連を伝える。** 作成・更新したファイルの ID と、リンクした先を報告する。

## note の昇格

`note` は「まだ確かめていない」印であって置き場所ではない。.claude/rules/knowledge-authoring.md「note を昇格させる」の 3 項目が揃ったら type を変え (nature も見直し)、`pnpm check` を通す。ファイルは動かさないので ID は変わらない。

## 検索

似た知識が既に無いか、先に `pnpm run search --text <語>` や `pnpm run search --tag <tag>` (`run` を省くと pnpm 組み込みの npm 検索に取られる) で確認する。
subject で絞るなら `--path hook/`、性質で絞るなら `--nature fact` のように指定する。
