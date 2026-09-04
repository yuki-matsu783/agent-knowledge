---
type: how-to
title: markdown の表や CSV から xlsx を生成する (uv + openpyxl)
description: >-
  How to turn GFM tables in a markdown file, or CSV files, into a formatted .xlsx workbook using the
  repository's Python script under uv and openpyxl, following the formatting rules of Anthropic's
  xlsx skill. Use when a knowledge table, eval result, or index must be handed over as a spreadsheet.
  Not for workbooks that need formulas or recalculation (that needs LibreOffice, which this setup
  does not include), and not for reading or analysing existing spreadsheets.
tags: [workflow, meta]
keywords: [Excel, xlsx, CSV, markdown, GFM table, openpyxl, uv, pandas, Anthropic xlsx skill, recalc.py, LibreOffice, 書き出し, Arial]
status: verified
verified_at: 2026-09-05
applies_to: [uv@0.12.9, python@3.12.11, openpyxl@3.1.5, anthropics-skills-xlsx@2026-09]
sources:
  - https://github.com/anthropics/skills
  - https://openpyxl.readthedocs.io/
  - https://docs.astral.sh/uv/
---

# markdown の表や CSV から xlsx を生成する (uv + openpyxl)

## 前提

- uv が入っていること。Python 本体は `uv sync` が pyproject.toml の `requires-python` に合わせて用意する (システムの Python 2.7 は使われない)
- 依存は pyproject.toml の openpyxl と pandas。`uv sync` で `.venv` にインストールされる
- Anthropic の xlsx skill はプロジェクトローカルの `.claude/skills/xlsx` に複製済み。生成物の要件 (Arial、数式は書かない、ハードコードした数値には出典) はそこから取っている

## 手順

1. 正となる表を用意する。markdown の GFM 表か CSV (UTF-8、BOM 可)。
2. 変換する。markdown は表ごとに 1 シート、直前の見出しがシート名になる。

   ```sh
   pnpm xlsx INDEX.md adr/0001-repository-conventions.md -o out/index.xlsx
   pnpm xlsx knowledge/data/results.csv -o out/results.xlsx
   ```

3. 生成物は成果物として扱う。slides/*.html と同じく、共有するならコミットする。

## 確認方法

openpyxl で読み戻してシート名と行数を見る。

```sh
uv run python -c "from openpyxl import load_workbook; wb=load_workbook('out/index.xlsx'); print([(ws.title, ws.max_row, ws.max_column) for ws in wb.worksheets])"
```

## つまずきどころ

- **数式は書けない。** openpyxl は数式を文字列で書くだけで値をキャッシュしないため、skill は LibreOffice の `recalc.py` を必須にしている。この環境には LibreOffice が無いので、値だけを書く用途に限る
- **Windows のコンソールは cp932** で日本語ログが化ける。スクリプト側で stdout / stderr を UTF-8 に再設定している。ワークブックの中身は壊れていない
- **シート名は 31 文字まで、`[]:*?/\` 不可。** 見出しが長いと切られる
- **skill 本体は Proprietary ライセンス** (LICENSE.txt)。ローカル利用は問題ないが、再配布はしない
- 上の Excel 出力先 `out/` はコミットしない。共有する成果物は用途に応じた場所へ置く
