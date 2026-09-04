---
type: note
title: markdown / CSV から Excel (xlsx) を書き出す手段
description: >-
  Unverified survey of ways to produce .xlsx files from markdown tables or CSV in this repository's
  toolchain: Node libraries (exceljs, SheetJS), Python libraries under uv (openpyxl, pandas), and
  Anthropic's public xlsx skill for Claude. Use when a knowledge table or eval result must be handed
  over as a spreadsheet instead of markdown. Not for reading or analysing existing spreadsheets, and
  none of these have been tried in this repository yet.
tags: [workflow, meta]
keywords: [Excel, xlsx, CSV, markdown, exceljs, SheetJS, openpyxl, pandas, uv, skills, 書き出し, 表]
status: outdated
verified_at: 2026-09-05
superseded_by: knowledge/xlsx-from-markdown-tables-with-uv
sources:
  - https://github.com/exceljs/exceljs
  - https://github.com/SheetJS/sheetjs
  - https://openpyxl.readthedocs.io/
  - https://github.com/anthropics/skills
---

# markdown / CSV から Excel (xlsx) を書き出す手段

> この知識は superseded_by の知識 ([knowledge/xlsx-from-markdown-tables-with-uv.md](../knowledge/xlsx-from-markdown-tables-with-uv.md)) により無効。uv + openpyxl で実際に生成できることを確認した。

## 背景

PPTX と同じく、提出物が Excel 指定のことがある。markdown の表や CSV を正として、xlsx を生成物にしたい。

## 選択肢 (未検証)

| 手段 | 環境 | 向き | 気になる点 |
|---|---|---|---|
| exceljs | Node (pnpm) | 書式・列幅・複数シートまで制御したい | API が冗長。CSV からの変換は自前で 20 行程度 |
| SheetJS (xlsx) | Node (pnpm) | CSV / JSON → xlsx を最短で | 無償版は書式が弱い。ライセンスは Apache-2.0 の Community Edition |
| openpyxl | Python (uv) | 書式込みで確実に作りたい | Python 環境が増える |
| pandas `to_excel` | Python (uv) | CSV を 1 行で xlsx に | 内部で openpyxl が要る |
| Anthropic の xlsx skill | Claude (skills) | Claude に表計算ファイルを作らせる | Python 依存。リポジトリの規約に合わせる設定が要る |

markdown の表をそのまま読む変換ツールは定番が無い。markdown 表 → CSV は 10 行のスクリプトで書けるので、正は CSV に寄せる方が楽。

## このリポジトリでの方針案

- 正は `knowledge/` 内の markdown 表、または `knowledge/data/<slug>.csv`
- 生成は Node + exceljs の `scripts/build-xlsx.ts` (TypeScript、tsx) で `pnpm xlsx` として統一する。Python を増やさずに済む
- 生成物は slides/*.html と同じく成果物としてコミットする

## 昇格チェック

- [ ] type を決めた (how-to になる見込み)
- [ ] exceljs で CSV → xlsx を実際に試す
- [ ] applies_to に exceljs のバージョンを書く
- [ ] 実際に試して verified_at を書ける
