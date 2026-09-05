---
type: note
nature: opinion
title: marpx なら Marp から編集可能な PPTX を作れるはず (未検証)
description: >-
  Unverified note on marpx, a Python tool that renders Marp HTML in Chromium and rebuilds it as native,
  editable PowerPoint shapes (text, tables with colspan/rowspan, notes, page numbers). Use when a deck
  built with slide-make must be delivered as an editable .pptx. Not for HTML or PDF output, which
  marp-cli already covers, and not yet verified in this repository.
tags: [workflow, meta]
keywords: [marpx, pptx, PowerPoint, Marp, marp-cli, --pptx, --pptx-editable, LibreOffice, Playwright, python-pptx, uv, 編集可能]
status: stable
sources:
  - https://github.com/FukumotoIkuma/marpx
---

# marpx なら Marp から編集可能な PPTX を作れるはず (未検証)

## 背景

marp-cli の PPTX 出力には 2 通りあるが、どちらも「編集可能なネイティブ PowerPoint」にならない。

| 方法 | 問題 |
|---|---|
| `marp --pptx` | 全スライドが PNG 画像になり、テキスト編集不可 |
| `marp --pptx-editable` | LibreOffice が必要。テーブルがばらばらのシェイプに分解される |

marpx は Marp の HTML を Chromium (Playwright) で描画し、DOM と算出スタイルと座標を読み取って python-pptx でネイティブ要素に変換する。

## 使い方 (README より、未検証)

```sh
git clone https://github.com/FukumotoIkuma/marpx.git
cd marpx
uv sync
uv run playwright install chromium
uv run marpx your-slide.md -o output.pptx
```

## できること (README より)

- テキスト・見出し・リストが編集可能
- テーブルがネイティブ PowerPoint テーブル (colspan / rowspan 対応)
- 背景画像、スピーカーノート、ヘッダー / フッター / ページ番号
- SVG は rsvg-convert でラスタライズ、数式は高解像度フォールバック
- CJK フォントを含む 50 以上のフォントマッピング

## 注意

作者いわく、Marp が出力する HTML / CSS の全パターンを網羅しておらず、観測したケースにだけ対応している。見慣れないレイアウトでは変換が崩れる可能性がある。

## ソースから分かること (2026-09-05、commit 316ba66 を読んだ)

- **Python だけでは動かない。** `src/marpx/extraction/marp_renderer.py` が `shutil.which("npx")` で npx を探し、
  `npx @marp-team/marp-cli@4.2.3` (バージョン固定) で Markdown を HTML にしてから Playwright に渡す。npx が無いと
  「npx not found. Please install Node.js (>=18) and npm.」で止まる。README の前提にも Node.js >= 18 と npm / npx がある
- このリポジトリは npm / npx を使わない方針なので、使うなら marp-cli の呼び出しを pnpm 側の `@marp-team/marp-cli` に差し替えるか、
  HTML を先に `pnpm slides` で作ってから marpx の HTML 入力側だけを使えるかを見る必要がある (どちらも未確認)
- 依存は python-pptx、playwright、click、pydantic 2、Pillow、rich、numpy 2.4 以上、latex2mathml。`requires-python >= 3.11`
- marp-cli のタイムアウトは 60 秒固定
- Mermaid はコードブロックのまま (marp-cli が描画しないため。README は `mmdc` 前処理を将来対応としている)

実行はまだしていない。`uv sync` から先 (Chromium の取得、変換) は未検証のまま。

## このリポジトリでの位置づけ

- slide-make skill は HTML 出力まで。PPTX が必要になった時点で marpx を試し、`templates/marp-theme.css` で崩れる箇所があれば記録する
- Python 部分は uv で扱う (CLAUDE.md の方針どおり)。ただし上のとおり Node と npx も要る

## 昇格の目安

これが揃ったら type を `note` から変える (.claude/rules/knowledge-authoring.md「note を昇格させる」)。

- [ ] 粒度が type の定義に収まっている (how-to になる見込み)
- [ ] sources に一次情報がある (README のみ。実行結果の記録が必要)
- [ ] applies_to に検証したバージョンがある
- [ ] 実際に試して verified_at を書ける
