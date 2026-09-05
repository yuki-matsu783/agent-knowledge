---
paths:
  - "knowledge/**/*.md"
  - "adr/**/*.md"
  - "slides/**/*.md"
  - "templates/**/*.md"
---

# markdown の YAML frontmatter 規約

リポジトリ内の各 markdown に、種別・要約・タグ・鮮度を機械可読な形で持たせ、一覧化・検索・ツール連携をしやすくする。
`pnpm lint` (scripts/lint-frontmatter.mjs) がこの規約を検査する。語彙は taxonomy.yml が正。

## キー定義

OKF (Open Knowledge Format、<https://okf.md/spec/>) のフィールド定義に沿う。OKF に無いキーは「拡張」と記す。

| キー | 必須 | 説明 |
|---|---|---|
| `type` | 必須 | 種別。taxonomy.yml の `types` に定義した値のみ。type ごとに置けるディレクトリが決まる |
| `title` | 推奨 | 人間が読む名前。日本語でよい |
| `description` | **必須** | 一番力を入れるキー。英語で、何の知識か・いつ適用するか・いつ適用しないかを書く (下記「description の書き方」) |
| `resource` | 任意 | 対応する外部リソースを一意に識別する URI。無ければキーごと省略する |
| `tags` | 必須 | 横断的な主題分類。taxonomy.yml の `tags` にある語のみ。kebab-case、2〜4 個 |
| `keywords` | 推奨 (拡張) | 検索用の自由記述。本文の特徴的な語を 3〜20 個。日本語可 |
| `status` | 必須 (拡張) | `stable` / `deprecated` の 2 値。書いた時点で `stable` |
| `verified_at` | 任意 (拡張) | 最後に内容を確かめた日 (YYYY-MM-DD)。書いてあれば `pnpm audit` が古さの判定に使う |
| `applies_to` | 任意 (拡張) | 確かめた製品とバージョン。`name@version` 形式のリスト (例 `claude-code@2.1`) |
| `sources` | 任意 (拡張) | 出典 URL またはリポジトリ内パスのリスト。knowledge/ で無いと warning が出るが error にはしない |
| `superseded_by` | 条件付き必須 (拡張) | status が deprecated のとき、無効化した側の ID (knowledge か `.claude/docs/`) |
| `derived_from` | slide のみ必須 (拡張) | スライドの元になった knowledge か `.claude/docs/` のドキュメントの ID |

ID はリポジトリルートからの相対パスから `.md` を除いたもの (例 `knowledge/tool-definition-design`)。

## description の書き方

description は、エージェントや人が「この知識を今読むべきか」を本文を開かずに判断するための文。
Claude Code の SKILL.md の description と同じ発想で書く。

- 英語を基本にする。他のキーが日本語でも description は英語で書く。固有名詞や日本語でしか表せない語はそのまま日本語でよい (lint は日本語混入を検査しない)
- 3 つを必ず含める: **何の知識か** (What)、**いつ適用するか** (Use when ...)、**いつ適用しないか** (Not for ... / Does not cover ...)
- 具体的な状況・症状・製品名を入れる。検索とマッチングに効くのは抽象語ではなく具体語
- 長さは 2〜4 文、目安 150〜400 字。1 文の要約で済ませない。lint は 80 字未満を warning にする
- YAML では `>-` のブロックスカラーで書くと `: ` の問題を気にせず改行できる

```yaml
description: >-
  Explains why tool descriptions longer than a few hundred words make Claude pick the wrong tool,
  and how to trim them. Use when designing or debugging tool definitions for the Claude API or
  Agent SDK where tool selection is unstable. Not for MCP server transport issues or prompt
  wording outside tool schemas.
```

## 例

```yaml
---
type: pitfall
title: ツール定義の description が長すぎると選択精度が落ちる
description: >-
  Explains why tool descriptions longer than a few hundred words make Claude pick the wrong tool,
  and how to trim them. Use when designing or debugging tool definitions for the Claude API or
  Agent SDK where tool selection is unstable. Not for MCP server transport issues or prompt
  wording outside tool schemas.
tags: [tool-use, prompting]
keywords: [ツール定義, description, 長さ, 呼び分け, 精度]
status: stable
verified_at: 2026-09-05
applies_to: [claude-api@2026-09]
sources:
  - https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview
---
```

## 値の書き方

- plain scalar に半角コロン＋半角スペース (`: `) を含めない。YAML がマッピング区切りと誤認する。必要ならダブルクォートで囲む
- flow sequence `[...]` の中にプレースホルダの説明文をカンマ区切りで書かない。カンマは要素区切りになる。説明は行末の `#` コメントで書く (例 `tags: []  # kebab-case, 2〜4個`)
- 日付は常に `YYYY-MM-DD`。クォート不要
- HTML スライド (slides/*.html) の frontmatter は先頭の HTML コメント内に同じ YAML を置く。scripts/build-slides.mjs が生成時に付与するので手で書かない

## 対象外ファイル

`.claude/` 配下 (skills、rules) と `templates/` は独自の frontmatter を持つため lint 対象外。README.md と CLAUDE.md には frontmatter を付けない。INDEX.md は生成物。
