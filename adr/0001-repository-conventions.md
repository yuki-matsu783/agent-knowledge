---
type: adr
title: リポジトリ規約の初期決定
description: >-
  Records the founding conventions of this knowledge repository: frontmatter schema with freshness keys,
  closed type and tag vocabularies, flat knowledge directory, relative-path links, Marp-generated HTML
  slides kept separate from plain knowledge markdown, TypeScript scripts run with tsx under pnpm,
  and how outdated knowledge is retained. Use when deciding where or how to add content, or when
  proposing a change to any of these conventions. Not for the day-to-day writing procedure, which lives
  in the skills and rules.
tags: [meta, workflow]
keywords: [規約, frontmatter, taxonomy, ディレクトリ, 相対パス, Marp, tsx, pnpm, uv, outdated, superseded_by, index.jsonl, ADR]
status: verified
verified_at: 2026-09-05
sources:
  - https://okf.md/spec/
  - https://marp.app/
  - https://github.com/FukumotoIkuma/marpx
  - https://github.com/tt-a1i/archify
---

# リポジトリ規約の初期決定

## 状況

エージェント開発の知見を集約するリポジトリを立ち上げるにあたり、後から変えにくい規約 (ID、ディレクトリ、frontmatter、ツールチェーン) を最初に決める必要があった。

## 決定

| 項目 | 決定 |
|---|---|
| frontmatter | OKF 準拠の `type` `title` `description` `resource` `tags` `keywords` に、鮮度用の `status` `verified_at` `applies_to` `sources` `superseded_by` を加える |
| description | 一番力を入れるキー。英語で What / Use when / Not for を書く。SKILL.md の description と同じ発想 |
| type | 閉じた語彙 9 種: concept / how-to / reference / pattern / pitfall / adr / note / slide / index。粒度は type 別に規定 |
| tags | 統制語彙 (taxonomy.yml) + lint。keywords は自由記述で検索用 |
| 出典 | frontmatter の `sources` リスト。knowledge/ で verified にするには必須 |
| ディレクトリ | 主題型。当面は knowledge/ 直下フラット、20 件を超えたら主題ディレクトリを切る |
| ファイル名 | ASCII kebab-case。日本語は title に |
| ID | ディレクトリ + ファイル名 (拡張子なし) |
| リンク | 相対パスのみ。wikilink 禁止 |
| スライド | Marp markdown を slides/ に別ファイルで置き、`derived_from` で元 knowledge を指す。knowledge 側に Marp 記法は入れない。HTML は生成物だがコミットする。HTML の frontmatter は先頭コメント内 |
| 無効化 | outdated は削除せず残し、`superseded_by` でどの knowledge に置き換えられたかを残す |
| 図 | 単純な図は mermaid。複雑な構成図は archify (プロジェクトローカルの .claude/skills/archify)。グローバルインストールはしない |
| 図のテンプレート | archify の JSON は白紙から書かず templates/archify/ の検証済み 7 パターンから複製する。プレビュー HTML は 1 本 700KB あるので gitignore し `pnpm diagrams` で再生成する |
| スクリプト | TypeScript (tsx、pnpm) が既定。xlsx / docx / pptx や pandas が要る処理は Python (uv、pyproject.toml、ruff)。判断基準は出力先のエコシステム (.claude/rules/scripting.md) |
| Excel 出力 | markdown の表と CSV を正とし、`pnpm xlsx` (uv + openpyxl) で生成する。Anthropic の xlsx skill はローカルに複製し、書式要件だけ借りる。数式が要る場合は LibreOffice が別途必要 |
| 想定環境 | Windows (Git Bash) と Linux。hook は POSIX sh、パスは `/` に正規化 |
| 検査 | pre-commit (lint + INDEX.md 生成) と skill 内実行の併用 |
| index | ディレクトリごとの index.jsonl (gitignore、SessionStart hook で再生成) と INDEX.md (コミット) |
| 秘匿 | 業務由来の知見は書かない |
| 本文 | 日本語 |

## 却下した案

| 案 | 却下した理由 |
|---|---|
| 一律の行数基準で分割 | 内容の性質に合わない。type 別規定の方が lint に乗せやすい |
| wikilink | GitHub で動かず、独自リゾルバが必要 |
| テンプレート HTML に直接書く | markdown と乖離し、差分レビューできない |
| tags を自由記述 | 数か月で表記ゆれし検索に使えなくなる |
| 出典を本文セクションのみ | 機械可読でなく lint に乗らない |
| outdated を削除 / archive 移動 | 過去の挙動の記録自体が知識。ID を変えると参照が壊れる |
| index.jsonl の mtime キャッシュ (bash 版の踏襲) | Node では数百ファイルの解析が 1 秒未満で済み、キャッシュ無効化の複雑さに見合わない |
| marp-cli の `--pptx` | 各スライドが画像になり編集不可。編集可能な PPTX は marpx (外部ツール) で別途検討 |
| archify をグローバルインストール | 環境依存になり、リポジトリだけで再現できない。`pnpm dlx skills add ... --copy` でローカルに複製する |
| 構成図もすべて mermaid | ノード数が増えると読めず、正しさを検証できない。archify は検証ゲートを通った図だけを出力する |
| スクリプトを Python に統一 | Marp・archify が Node なので Node は避けられない。Python を既定にすると常に 2 ランタイム必須になる。frontmatter は YAML 1.2 (Node の yaml) で読む方が日付や on/off が化けない。速度は判断材料にしない (実測で wrapper の起動コストが支配的) |
| git hook を常に動かす | VS Code や手動 commit では PATH に pnpm/node が無いことがあり、hook の stderr がそのままエラー表示になる。Claude Code が git を使ったとき (CLAUDECODE=1) だけ動かす |
| スクリプトを TypeScript に統一 | xlsx / docx / pptx の生成ライブラリと Anthropic の document skills は Python 前提。無理に Node で書くと品質が落ちる |
| Excel 出力を Node (exceljs / SheetJS) で書く | 動くが、document skills の書式要件と乖離する。Python を入れる前提が決まったので openpyxl に寄せた |

## 影響

- 新規 markdown は必ず skill (knowledge-add / slide-make / knowledge-audit) 経由で作る
- taxonomy.yml の変更は ADR を伴わなくてよいが、type の追加・削除は ADR を書く
- 主題ディレクトリを切るときは ID が変わるので、superseded_by と derived_from とリンクを一括更新する
