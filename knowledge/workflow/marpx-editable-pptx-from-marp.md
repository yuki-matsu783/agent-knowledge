---
type: how-to
nature: best-practice
title: Marp の markdown から編集可能な PPTX を作るには marpx を uv で入れ marp-cli を npx で先に温めるべき
description: >-
  Verified procedure for turning a Marp deck into a native, editable PowerPoint file with marpx, a
  Python tool that renders marp-cli HTML in Playwright Chromium and rebuilds it with python-pptx.
  Run on Windows Git Bash with uv 0.12, Python 3.12, Node 22 against this repository's theme: text
  boxes, a 5x2 table, code blocks, and page numbers came out as native shapes with zero fallback
  images. Covers the two things that made the first run fail: marpx shells out to `npx
  @marp-team/marp-cli@4.2.3` with a 60 second timeout, so the first download must be done beforehand,
  and rich crashes on cp932 when printing the failure mark unless PYTHONUTF8=1 is set. Use when a
  deck built with slide-make must be delivered as .pptx. Not for HTML or PDF output, which marp-cli
  already covers, and the visual fidelity in PowerPoint itself was not checked (only the shape tree).
tags: [workflow, meta]
keywords: [marpx, pptx, PowerPoint, Marp, marp-cli, --pptx, --pptx-editable, LibreOffice, Playwright, python-pptx, uv, npx, PYTHONUTF8, cp932, UnicodeEncodeError, marp-cli timed out, --theme, 編集可能, ネイティブ表]
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [marpx@0.1, marp-cli@4.2, uv@0.12, node@22]
sources:
  - https://github.com/FukumotoIkuma/marpx
  - https://github.com/marp-team/marp-cli
---

# Marp の markdown から編集可能な PPTX を作るには marpx を uv で入れ marp-cli を npx で先に温めるべき

## 前提

marp-cli 自身の PPTX 出力は 2 通りあるが、どちらも「編集可能なネイティブ PowerPoint」にならない。

| 方法 | 問題 |
|---|---|
| `marp --pptx` | 全スライドが PNG 画像になり、テキスト編集不可 |
| `marp --pptx-editable` | LibreOffice が必要。テーブルがばらばらのシェイプに分解される |

marpx (0.1.0、commit 316ba66、2026-03) は Marp の HTML を Chromium (Playwright) で描画し、DOM と算出スタイルと座標を読み取って python-pptx でネイティブ要素に変換する。

必要なもの (Windows の Git Bash で確認)。

- uv 0.12 と Python 3.12 (`requires-python >= 3.11`)
- **Node 22 と npx。** Python ツールだが、markdown → HTML は `npx @marp-team/marp-cli@4.2.3` (バージョン固定) を子プロセスで呼ぶ。
  npx が無いと「npx not found. Please install Node.js (>=18) and npm.」で止まる。このリポジトリは npm / npx を使わない方針なので、
  marpx を使う間だけの例外として扱う
- Chromium 約 110 MB のダウンロード (1 回)

## 手順

1. 追跡外の作業ディレクトリにクローンして依存を入れる

   ```sh
   git clone --depth 1 https://github.com/FukumotoIkuma/marpx.git wip/local/marpx
   cd wip/local/marpx
   uv sync
   uv run playwright install chromium
   ```

2. **marp-cli を先に 1 回 npx で取得しておく。** marpx は marp-cli の呼び出しに 60 秒の timeout を持っており、初回の npx ダウンロード
   (手元で 16 秒、遅い回線ならそれ以上) がそこに食い込むと失敗する。実際、温めずに走らせた 1 回目は 2 分 28 秒かかって失敗した

   ```sh
   npx -y @marp-team/marp-cli@4.2.3 --version
   ```

3. UTF-8 を強制して変換する。テーマは CSS ファイルのパスで渡す

   ```sh
   export PYTHONUTF8=1 PYTHONIOENCODING=utf-8
   uv run marpx -v --theme ../../templates/marp-theme.css ../../slides/marp-html-slides-from-markdown.md -o out/deck.pptx
   ```

   8 枚のデッキで 25 秒。`-v` を付けるとスライドごとに「Slide N: 3 native, 0 fallback elements」と出るので、画像に落ちた要素があればここで分かる。

## 確認方法

python-pptx で shape の木を読む (PowerPoint は無くてよい)。

```sh
uv run python -c "
from pptx import Presentation
p = Presentation('out/deck.pptx')
for i, s in enumerate(p.slides, 1):
    print(i, [(sh.shape_type, sh.has_text_frame and sh.text_frame.text[:20]) for sh in s.shapes])
"
```

このリポジトリのテーマで出た結果 (2026-09-05)。

| 元の要素 | PPTX での形 |
|---|---|
| 見出し、段落、リスト | TEXT_BOX。文字はそのまま編集できる |
| 5 行 2 列の markdown テーブル | ネイティブの TABLE (5x2) |
| fenced code block | 角丸の FREEFORM にテキスト。枠線はごく細い AUTO_SHAPE の矩形 (4 本) |
| `paginate: true` のページ番号 | 右下の TEXT_BOX に「1 / 8」 |
| `section.lead` の `linear-gradient` 背景 | スライド全面の PICTURE (背景だけラスタ化。上の文字は TEXT_BOX) |
| 見出し下の罫線 | 高さ 0.03 インチの AUTO_SHAPE |

サイズは 13.33 x 7.5 インチ (16:9)。fallback (画像化) は 0 件。スピーカーノートは元のデッキに無いので未確認。

## つまずきどころ

- **失敗の本当の理由が見えない。** 失敗時に rich が「✗」を出そうとして、Windows のコンソールが cp932 だと
  `UnicodeEncodeError: 'cp932' codec can't encode character '✗'` で落ち、本来のエラー文が消える。`PYTHONUTF8=1` を先に付ける。
  1 回目の失敗の実体もこれで隠れた (再現条件から marp-cli の timeout と判断したが、文言は取れていない)
- **`--theme` を付けないと default テーマになる。** frontmatter の `theme: agent-knowledge` は marp-cli が CSS を知らないので黙って default に落ちる。
  変換は成功するので気づきにくい。テーマ CSS のパスを必ず渡す
- **グラデーション背景は画像になる。** 文字は編集できるが、背景色を PowerPoint 側で変えたいなら CSS を単色にしてから変換する
- 各スライドの左上隅に幅 0.1 インチの TEXT_BOX にスライド番号 1 文字だけが入る (ページ番号とは別)。テーマの `section::after` の副産物と思われる。害は無いが不要なら消す
- 作者いわく Marp が出力する HTML / CSS の全パターンを網羅しておらず、観測したケースにだけ対応している。見慣れないレイアウトでは `-v` の fallback 数を見る
- Mermaid はコードブロックのまま (marp-cli が描画しないため。README は `mmdc` 前処理を将来対応としている)
- 実行環境の記録: uv 0.12.9、Python 3.12.11、Node 22.15 / npx 10.8、Playwright chromium-headless-shell 1208、Windows 10 Git Bash。WSL と Linux では未確認

## このリポジトリでの位置づけ

- slide-make skill は HTML 出力まで。PPTX が要るときはこの手順で `wip/local/marpx` に入れて変換し、生成物は共有するものだけコミットする
- PowerPoint 上での見え方 (フォントの置換、行間、はみ出し) は確認していない。開いて崩れがあれば `templates/marp-theme.css` 側の該当箇所をここに追記する
