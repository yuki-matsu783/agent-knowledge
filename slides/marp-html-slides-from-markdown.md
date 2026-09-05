---
marp: true
theme: agent-knowledge
paginate: true
type: slide
title: Marp CLI で markdown から HTML スライドを生成する
description: >-
  Short deck introducing how this repository turns Marp markdown into themed HTML slides with marp-cli,
  what the build script adds, and where the limits are. Use when presenting the slide workflow of this
  repository to someone new. Not a reference for marp-cli options beyond the ones used here.
tags: [workflow, meta]
keywords: [Marp, marp-cli, スライド, HTML, テーマ, ワークフロー]
status: stable
verified_at: 2026-09-05
derived_from: .claude/docs/10_spec/marp-slides
sources:
  - https://github.com/marp-team/marp-cli
  - https://marpit.marp.app/directives
---

<!-- _class: lead -->

# Marp CLI で markdown から HTML スライドを生成する

このリポジトリのスライド作成フロー

---

## 結論

- knowledge の markdown は汚さず、slides/ に別ファイルを置く
- `pnpm slides` 一発でテーマ付き HTML ができる
- PPTX が要るなら別ツール (marpx) を検討する

---

## 背景

- 知見を人に説明する場面ではスライドが要る
- HTML を手で書くと markdown と乖離する
- Marp なら markdown が正、HTML は生成物にできる

---

## ファイルの関係

| ファイル | 役割 |
|---|---|
| `knowledge/foo.md` | 知識の本体。Marp 記法なし |
| `slides/foo.md` | Marp markdown。`derived_from` で元を指す |
| `slides/foo.html` | 生成物。先頭コメントに frontmatter |
| `templates/marp-theme.css` | 共通テーマ |

---

## 生成コマンド

```sh
pnpm slides slides/foo.md
```

- marp-cli を `--theme-set` 付きで呼ぶ
- Marp 固有キーを除いた frontmatter を HTML 先頭のコメントに埋め込む
- `built_from` に元の slides ID を残す

---

## つまずきどころ

- `theme:` の名前が `@theme` と違うと黙って default になる
- mermaid は描画されない。表か箇条書きにする
- `--pptx` は画像化される。編集可能な PPTX は marpx

---

## まとめ

- 手順の詳細は `.claude/docs/10_spec/marp-slides.md`、要件は `.claude/docs/00_requirement/marp-slides.md`
- スライド作成の手順は `.claude/skills/slide-make/SKILL.md`

---

## 出典

- https://github.com/marp-team/marp-cli
- https://marpit.marp.app/directives
