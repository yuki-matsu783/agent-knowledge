---
type: how-to
title: Marp CLI で markdown から HTML スライドを生成する
description: >-
  Step-by-step for turning a Marp-flavored markdown file into a self-contained HTML deck with marp-cli,
  including a custom theme via --theme-set and keeping non-Marp frontmatter keys alongside Marp
  directives. Use when you need HTML or PDF slides from markdown in a Node project, or when wiring
  marp-cli into a build script. Not for editable PPTX output (marp-cli rasterizes slides) and not for
  Marp's VS Code extension workflow.
tags: [workflow, meta]
keywords: [Marp, marp-cli, スライド, HTML, テーマ, --theme-set, --html, frontmatter, ディレクティブ, paginate, lead, pnpm]
status: verified
verified_at: 2026-09-05
applies_to: [marp-cli@4.5.0, node@22.15]
sources:
  - https://github.com/marp-team/marp-cli
  - https://marpit.marp.app/directives
  - https://marpit.marp.app/theme-css
---

# Marp CLI で markdown から HTML スライドを生成する

## 前提

- Node 20 以上と pnpm
- `@marp-team/marp-cli` を devDependency に入れる (`pnpm add -D @marp-team/marp-cli`)
- HTML 出力だけならブラウザは不要。PDF / PPTX / 画像出力は Chromium が要る

## 手順

1. markdown の先頭に Marp のグローバルディレクティブを frontmatter で書く。Marp が知らないキー (`type` `tags` など) は無視されるので、独自の frontmatter と同居できる。

   ```yaml
   ---
   marp: true
   theme: agent-knowledge
   paginate: true
   type: slide
   tags: [workflow]
   ---
   ```

2. スライドは `---` で区切る。1 枚目を表紙にするならローカルディレクティブでクラスを付ける。

   ```markdown
   <!-- _class: lead -->
   # 題名
   ```

3. 独自テーマは CSS の先頭行に `/* @theme <name> */` を書き、`@import 'default'` で標準テーマを継承する。

4. 変換する。`--theme-set` でテーマ CSS を登録し、`--html` で markdown 内の HTML を許可する。

   ```sh
   pnpm exec marp --theme-set templates/marp-theme.css --html slides/foo.md -o slides/foo.html
   ```

   スクリプトから呼ぶときは `node_modules/@marp-team/marp-cli/marp-cli.js` を `node` で直接実行すると、npx を経由せずに済む。

## 確認方法

生成された HTML をブラウザで開く。ページ番号が右下に出ていれば `paginate` が効いている。テーマが当たっていなければ `--theme-set` のパスか `@theme` 名の綴りを疑う。

## つまずきどころ

- `theme:` に指定した名前が `@theme` と一致しないと、警告なしで default テーマになる
- mermaid のコードブロックは描画されない。図は表か箇条書きにする
- `--pptx` は各スライドを画像にするので、編集可能な PPTX にはならない。代替は [marpx のメモ](../inbox/marpx-editable-pptx-from-marp.md)
