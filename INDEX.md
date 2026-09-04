---
type: index
title: 知識インデックス
description: frontmatter から自動生成した全 markdown の一覧
tags: [meta]
keywords: [index, 一覧, frontmatter, 自動生成]
---

# 知識インデックス

生成物。手で編集しない。`pnpm index` で再生成する。

## knowledge

| ID | title | type | status | tags | verified_at |
|---|---|---|---|---|---|
| [knowledge/archify-diagrams-from-templates](knowledge/archify-diagrams-from-templates.md) | archify のテンプレートから検証付き構成図を作る | how-to | verified | workflow, meta, claude-code | 2026-09-05 |
| [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md) | タイムアウトした hook はガードにならず素通りする | pitfall | verified | claude-code, security, workflow | 2026-09-05 |
| [knowledge/marp-html-slides-from-markdown](knowledge/marp-html-slides-from-markdown.md) | Marp CLI で markdown から HTML スライドを生成する | how-to | verified | workflow, meta | 2026-09-05 |
| [knowledge/ticket-scoped-deny-hook](knowledge/ticket-scoped-deny-hook.md) | チケットの frontmatter を根拠に範囲外の操作を deny する | pattern | verified | claude-code, context-management, security | 2026-09-05 |
| [knowledge/xlsx-from-markdown-tables-with-uv](knowledge/xlsx-from-markdown-tables-with-uv.md) | markdown の表や CSV から xlsx を生成する (uv + openpyxl) | how-to | verified | workflow, meta | 2026-09-05 |

## inbox

| ID | title | type | status | tags | verified_at |
|---|---|---|---|---|---|
| [inbox/archify-verified-architecture-diagrams](inbox/archify-verified-architecture-diagrams.md) | archify で検証付きの構成図を生成する | note | outdated | workflow, meta, claude-code | 2026-09-05 |
| [inbox/excel-export-from-markdown-csv](inbox/excel-export-from-markdown-csv.md) | markdown / CSV から Excel (xlsx) を書き出す手段 | note | outdated | workflow, meta | 2026-09-05 |
| [inbox/marpx-editable-pptx-from-marp](inbox/marpx-editable-pptx-from-marp.md) | marpx で Marp から編集可能な PPTX を作る | note | draft | workflow, meta |  |

## adr

| ID | title | type | status | tags | verified_at |
|---|---|---|---|---|---|
| [adr/0001-repository-conventions](adr/0001-repository-conventions.md) | リポジトリ規約の初期決定 | adr | verified | meta, workflow | 2026-09-05 |

## slides

| ID | title | type | status | tags | verified_at |
|---|---|---|---|---|---|
| [slides/marp-html-slides-from-markdown](slides/marp-html-slides-from-markdown.md) | Marp CLI で markdown から HTML スライドを生成する | slide | verified | workflow, meta | 2026-09-05 |

## タグ別

- **claude-code**: [inbox/archify-verified-architecture-diagrams](inbox/archify-verified-architecture-diagrams.md), [knowledge/archify-diagrams-from-templates](knowledge/archify-diagrams-from-templates.md), [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md), [knowledge/ticket-scoped-deny-hook](knowledge/ticket-scoped-deny-hook.md)
- **context-management**: [knowledge/ticket-scoped-deny-hook](knowledge/ticket-scoped-deny-hook.md)
- **meta**: [adr/0001-repository-conventions](adr/0001-repository-conventions.md), [inbox/archify-verified-architecture-diagrams](inbox/archify-verified-architecture-diagrams.md), [inbox/excel-export-from-markdown-csv](inbox/excel-export-from-markdown-csv.md), [inbox/marpx-editable-pptx-from-marp](inbox/marpx-editable-pptx-from-marp.md), [knowledge/archify-diagrams-from-templates](knowledge/archify-diagrams-from-templates.md), [knowledge/marp-html-slides-from-markdown](knowledge/marp-html-slides-from-markdown.md), [knowledge/xlsx-from-markdown-tables-with-uv](knowledge/xlsx-from-markdown-tables-with-uv.md), [slides/marp-html-slides-from-markdown](slides/marp-html-slides-from-markdown.md)
- **security**: [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md), [knowledge/ticket-scoped-deny-hook](knowledge/ticket-scoped-deny-hook.md)
- **workflow**: [adr/0001-repository-conventions](adr/0001-repository-conventions.md), [inbox/archify-verified-architecture-diagrams](inbox/archify-verified-architecture-diagrams.md), [inbox/excel-export-from-markdown-csv](inbox/excel-export-from-markdown-csv.md), [inbox/marpx-editable-pptx-from-marp](inbox/marpx-editable-pptx-from-marp.md), [knowledge/archify-diagrams-from-templates](knowledge/archify-diagrams-from-templates.md), [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md), [knowledge/marp-html-slides-from-markdown](knowledge/marp-html-slides-from-markdown.md), [knowledge/xlsx-from-markdown-tables-with-uv](knowledge/xlsx-from-markdown-tables-with-uv.md), [slides/marp-html-slides-from-markdown](slides/marp-html-slides-from-markdown.md)

## 無効化された知識

| 旧 | 無効化した側 |
|---|---|
| [inbox/archify-verified-architecture-diagrams](inbox/archify-verified-architecture-diagrams.md) | [knowledge/archify-diagrams-from-templates](knowledge/archify-diagrams-from-templates.md) |
| [inbox/excel-export-from-markdown-csv](inbox/excel-export-from-markdown-csv.md) | [knowledge/xlsx-from-markdown-tables-with-uv](knowledge/xlsx-from-markdown-tables-with-uv.md) |
