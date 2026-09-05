---
type: spec
title: 表計算ファイル出力 (xlsx) の仕様
description: >-
  Full specification of this repository's xlsx pipeline: the pnpm xlsx command line, how the Python
  script detects GFM tables and names sheets, the exact formatting it applies (fonts, fill, freeze,
  autofilter, column widths), the type coercion rules, and the encoding and sheet-name limits. Use
  when generating, fixing, or modifying workbook output here. Not for deciding whether xlsx is the
  right deliverable (see the requirement) and not for reading existing spreadsheets.
status: stable
verified_at: 2026-09-05
applies_to: [uv@0.12.9, python@3.12.11, openpyxl@3.1.5, anthropics-skills-xlsx@2026-09]
sources:
  - https://github.com/anthropics/skills
  - https://openpyxl.readthedocs.io/
  - https://docs.astral.sh/uv/
  - ../../../scripts/xlsx/tables_to_xlsx.py
---

# 表計算ファイル出力 (xlsx) の仕様

要件と適用範囲は [00_requirement/xlsx-export.md](../00_requirement/xlsx-export.md) にある。

## 前提

- uv が入っていること。Python 本体は `uv sync` が pyproject.toml の `requires-python` に合わせて用意する (システムの Python 2.7 は使われない)
- 依存は pyproject.toml の openpyxl と pandas。`uv sync` で `.venv` にインストールされる
- Anthropic の xlsx skill はプロジェクトローカルの `.claude/skills/xlsx` に複製済み。生成物の要件 (Arial、数式は書かない、ハードコードした数値には出典) はそこから取っている

## 外部インタフェース

```sh
pnpm xlsx <input.md|input.csv> [<input> ...] -o <output.xlsx>
```

入力は複数渡せる。全部の表が 1 つのブックに順番に並ぶ。拡張子が `.md` `.markdown` `.csv` 以外なら error。

## 内部の挙動

実体は `scripts/xlsx/tables_to_xlsx.py`。

**表の検出 (markdown)**

- 先頭が `#` の行を見るたびに、現在の見出しを更新する。これがシート名の候補になる
- `|` を含む行の次の行が区切り行 (`---` や `:---:` の並び) なら、そこから表が始まったとみなす
- 以降、`|` を含む非空行を行として取り込む。空行か `|` の無い行で表が終わる
- セル分割は `|` だが、`\|` はエスケープとして扱い区切りにしない
- セル内のインライン記法は落とす。バッククォート、リンク (`[text](url)` はテキストだけ残る)、`**強調**`

**表の検出 (CSV)**

- `utf-8-sig` で読む。BOM 付きでも壊れない
- シート名の候補はファイル名 (拡張子なし)

**シート名**

- `[` `]` `:` `*` `?` `/` `\` は空白に置換する。Excel が受け付けないため
- 28 文字で切る。空になったら `Sheet`
- 重複したら先頭 25 文字 + ` (2)` `(3)` と連番を振る

**値の変換**

- 2 行目以降だけ、整数に見える文字列は int、小数に見える文字列は float に変換する。ヘッダー行は必ず文字列のまま
- 数式は一切書かない

**書式**

| 対象 | 設定 |
|---|---|
| ヘッダー行 | Arial 太字・白文字、背景 `0F3D5E`、縦中央 |
| 本文 | Arial、縦上寄せ。元の文字列が 60 文字を超えるセルだけ折り返し |
| 列幅 | 最長セルの文字数 × 1.1 + 2。下限 10、上限 60 |
| 固定 | `A2` で先頭行を固定 |
| フィルタ | `A1` から最終列・最終行までオートフィルタ |

列の数は、その表で一番長い行に合わせる。足りない列は空文字で埋める。

**その他**

- 起動時に stdout と stderr を UTF-8 に再設定する。Windows のコンソールが cp932 でも日本語ログが化けない
- openpyxl が既定で作る空シートは削除してから書き始める
- 出力先の親ディレクトリは自動で作る
- 成功すると stderr に `wrote: <path> sheets=N`。終了コードは 0
- 入力が無い、拡張子が違う、表が 1 つも見つからない、のいずれかで終了コード 1

## 設計判断

**なぜ Node ではなく Python か。** exceljs と SheetJS でも xlsx は書けるが、書式まで揃えると記述量が増え、Anthropic の xlsx skill が持つ書式要件と検証スクリプトを流用できない。
Python 環境は xlsx / docx / pptx と pandas のためにどのみち必要なので、そこに寄せた。`.claude/rules/scripting.md` の使い分け表がこの判断の根拠。

**なぜ uv か。** Python 本体とバージョンを uv が管理するので、システムの Python (Windows では 2.7 が居ることがある) に依存しない。バージョンは pyproject.toml の `requires-python` が正。

**なぜ数式を書かないか。** openpyxl は数式を文字列として書くだけで、計算結果をキャッシュしない。値の入っていないブックは受け取った側で開くまで空に見える。
skill 側はこれを LibreOffice の `recalc.py` で埋めているが、この環境に LibreOffice が無い。よって値だけを書く方針にした。

**なぜ pnpm 経由で呼ぶか。** 入口を 1 つにするため。`pnpm xlsx` は内部で `uv run python scripts/xlsx/tables_to_xlsx.py` を呼ぶ。

## 手順

1. 正となる表を用意する。markdown の GFM 表か CSV (UTF-8、BOM 可)。
2. 変換する。markdown は表ごとに 1 シート、直前の見出しがシート名になる。

   ```sh
   pnpm xlsx INDEX.md knowledge/hooks/deny-by-hook-not-permissions.md -o out/index.xlsx
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
- **シート名は 31 文字まで、`[]:*?/\` 不可。** 見出しが長いと切られる。同じ見出しが続くと連番が付く
- **見出しの無い表**は入力ファイル名がシート名になる。狙った名前にしたいなら表の直前に見出しを置く
- **数値に見える文字列は数値になる。** 型番や日付のような文字列を保ちたいなら、整数・小数に見えない形にする
- **skill 本体は Proprietary ライセンス** (LICENSE.txt)。ローカル利用は問題ないが、再配布はしない
- 上の Excel 出力先 `out/` はコミットしない。共有する成果物は用途に応じた場所へ置く
