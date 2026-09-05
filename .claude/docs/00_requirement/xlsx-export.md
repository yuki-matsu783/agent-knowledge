---
type: requirement
title: 表計算ファイル出力 (xlsx) の要件
description: >-
  External requirements in EARS form for handing over tabular data as an .xlsx workbook: the command
  the user calls, what goes in, what comes out, how success and failure are reported, and what the
  workbook must satisfy. The happy path is drawn as small mermaid flows. Use when deciding how to
  deliver tabular data or when judging whether the pipeline still meets its requirements. Not for
  implementation choices, library rationale, or internal behavior (see the spec).
status: verified
verified_at: 2026-09-05
applies_to: [uv@0.12.9, python@3.12.11, openpyxl@3.1.5, anthropics-skills-xlsx@2026-09]
sources:
  - https://github.com/anthropics/skills
  - https://openpyxl.readthedocs.io/
---

# 表計算ファイル出力 (xlsx) の要件

内部の挙動と実装判断は [10_spec/xlsx-export.md](../10_spec/xlsx-export.md) にある。ここには外から観測できることだけを書く。

## 背景

提出物が Excel 指定のことがある。markdown の表や CSV を正のまま残しつつ、渡す形だけ xlsx にしたい。
表そのものを xlsx で管理すると差分が読めなくなるので、正は markdown か CSV に置いたままにする。

## 外部要求 (EARS)

| ID | 型 | 要求 |
|---|---|---|
| REQ-XLS-01 | ユビキタス | xlsx 生成は、markdown の GFM 表と CSV を入力として受け付けること |
| REQ-XLS-02 | ユビキタス | xlsx 生成は、利用者に対して `pnpm xlsx <入力> -o <出力.xlsx>` という単一の入口を提供すること |
| REQ-XLS-03 | イベント駆動 | 入力を複数渡されたとき、xlsx 生成は、渡された順に表を並べた 1 つのブックを出力すること |
| REQ-XLS-04 | イベント駆動 | markdown を渡されたとき、xlsx 生成は、本文中の表をすべて拾い、表ごとに 1 シートを作ること |
| REQ-XLS-05 | イベント駆動 | シートを作るとき、xlsx 生成は、シート名を Excel が受け付ける形に整え、重複しないようにすること |
| REQ-XLS-06 | ユビキタス | 出力ブックは、Anthropic の xlsx skill の書式要件 (Arial、太字ヘッダー、先頭行固定、オートフィルタ、読める列幅) を満たすこと |
| REQ-XLS-07 | ユビキタス | 出力ブックは、数式を含まず値だけを持つこと |
| REQ-XLS-08 | イベント駆動 | 出力に成功したとき、xlsx 生成は、出力先とシート数を利用者に伝え、終了コード 0 で終わること |
| REQ-XLS-09 | 望ましくない挙動 | もし入力が存在しない、対応しない拡張子である、または表が 1 つも見つからないならば、xlsx 生成は、何も出力せず、理由を示して終了コード 1 で終わること |
| REQ-XLS-10 | 状態駆動 | Windows のコンソールが cp932 の間も、xlsx 生成は、日本語のメッセージを壊さずに表示すること |

## ハッピーパス

入力を用意するまで。

```mermaid
flowchart LR
  A[渡したい表] --> B[markdown の GFM 表]
  A --> C[knowledge/data の CSV]
  B --> D[pnpm xlsx で変換]
  C --> D
```

xlsx にして渡すまで。

```mermaid
flowchart LR
  E[表ごとに 1 シート] --> F[書式を適用して保存]
  F --> G[読み戻して内容を確認]
  G --> H[共有する成果物だけコミット]
```

## 適用範囲外

- **数式を含むブックは作れない。** 出力は値のみ
- 既存ブックの読み取りや分析はこの経路の対象外
- 元にした skill は Proprietary ライセンス。ローカル利用は問題ないが、再配布はしない

## 受け入れ条件

- `pnpm xlsx <in> -o <out.xlsx>` が終了コード 0 で完了し、`wrote: ... sheets=N` を返す
- 出力ブックを読み戻し、シート名・行数・列数が元の表と一致する
- 共有する成果物だけコミットする。作業用の出力先 `out/` はコミットしない
