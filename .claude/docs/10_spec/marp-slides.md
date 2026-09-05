---
type: spec
title: スライド生成 (Marp) の仕様
description: >-
  Full specification of this repository's slide pipeline: the pnpm slides command line, the Marp
  directives and theme contract, and how the build script drives marp-cli directly and then rewrites
  the generated HTML head with a comment-form frontmatter carrying built_from. Use when building,
  fixing, or modifying slide generation here. Not for deciding whether slides are the right format
  (see the requirement) and not for Marp's VS Code extension workflow.
status: verified
verified_at: 2026-09-05
applies_to: [marp-cli@4.5.0, node@22.15]
sources:
  - https://github.com/marp-team/marp-cli
  - https://marpit.marp.app/directives
  - https://marpit.marp.app/theme-css
  - ../../../scripts/build-slides.ts
---

# スライド生成 (Marp) の仕様

要件と適用範囲は [00_requirement/marp-slides.md](../00_requirement/marp-slides.md) にある。

## 前提

- Node 20 以上と pnpm
- `@marp-team/marp-cli` を devDependency に入れる (`pnpm add -D @marp-team/marp-cli`)
- テーマは `templates/marp-theme.css` の 1 本
- HTML 出力だけならブラウザは不要。PDF / PPTX / 画像出力は Chromium が要る

## 外部インタフェース

```sh
pnpm slides [<slides/foo.md> ...]
```

引数を省略すると `slides/` 配下の markdown をすべて変換する。出力は同じ場所に拡張子を `.html` に替えて置く。

## 内部の挙動

実体は `scripts/build-slides.ts`。

1. **起動チェック**: `node_modules/@marp-team/marp-cli/marp-cli.js` の存在を見る。無ければ `pnpm install` を促して終了コード 1
2. **対象の決定**: 引数があればそれ (`\` は `/` に正規化)。無ければ `git ls-files --cached --others --exclude-standard` で `slides/` の markdown を列挙する。追跡済みと未追跡の両方が入り、gitignore 対象は入らない
3. **変換**: `process.execPath` で `marp-cli.js` を直接実行する。npx も pnpm exec も挟まない

   ```
   node node_modules/@marp-team/marp-cli/marp-cli.js --theme-set templates/marp-theme.css --html <md> -o <html>
   ```

   失敗したらそのファイルだけ error にして次へ進む
4. **frontmatter の引き継ぎ**: 元 markdown の frontmatter から Marp 固有キーを除いた残りを取り出す。除くのは `marp` `theme` `paginate` `style` `headingDivider` `size` `math` `lang` `class` `background*` `color` `footer` `header` `url` `image` `transition`
5. **built_from の付与**: 元 markdown の ID (ルートからの相対パスから `.md` を除いたもの) を `built_from` として足す
6. **HTML 先頭の差し替え**: 生成 HTML の先頭にすでにコメント形式の frontmatter があれば取り除き、4 と 5 の内容を `<!--` と `-->` で囲んだ YAML として付け直す。再実行しても重ならない
7. **終了**: 1 件でも失敗があれば終了コード 1。ログはすべて stderr

生成 HTML の先頭はこうなる。

```html
<!--
---
type: slide
title: ...
derived_from: knowledge/...
built_from: slides/marp-html-slides-from-markdown
---
-->
```

## 設計判断

**なぜ marp-cli を直接実行するか。** `npx` を挟むとプロセス起動が増えるうえ、ネットワークから取りに行く可能性が残る。
`node_modules` の実体を `process.execPath` で呼べば、依存はロックファイルで固定されたものだけになる。

**なぜ HTML 先頭に frontmatter を付け直すか。** marp-cli の出力には元 markdown の frontmatter が残らない。
生成物だけを渡されたときに元を辿れるよう、Marp 固有キーを除いた frontmatter と `built_from` をコメントとして付け足している。コメント形式なのはブラウザ表示を壊さないため。

**なぜ Marp 固有キーを落とすか。** `theme` や `paginate` は入力の指示であって、生成物の性質ではない。HTML 側に残すと、読んだ人が再ビルドの条件と混同する。

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

4. 変換する。

   ```sh
   pnpm slides slides/foo.md
   ```

   手で marp-cli を叩くなら `--theme-set` でテーマ CSS を登録し、`--html` で markdown 内の HTML を許可する。

   ```sh
   pnpm exec marp --theme-set templates/marp-theme.css --html slides/foo.md -o slides/foo.html
   ```

## 確認方法

生成された HTML をブラウザで開く。ページ番号が右下に出ていれば `paginate` が効いている。テーマが当たっていなければ `--theme-set` のパスか `@theme` 名の綴りを疑う。

## つまずきどころ

- `theme:` に指定した名前が `@theme` と一致しないと、警告なしで default テーマになる
- mermaid のコードブロックは描画されない。図は表か箇条書きにする
- `--pptx` は各スライドを画像にするので、編集可能な PPTX にはならない。代替は [marpx のメモ](../../../inbox/marpx-editable-pptx-from-marp.md)
- HTML 先頭の frontmatter はコメント形式なので、lint の対象にはならない。`built_from` を頼りに元を辿る
