---
type: requirement
title: Slidev から編集可能な PPTX への変換の要件
description: >-
  External requirements in EARS form for turning a Slidev deck into a native, editable PowerPoint
  file: the commands the user runs, the Vue components that declare which PowerPoint shape each
  element becomes, what the resulting deck must satisfy, and how failures are reported. The happy
  path is drawn as small mermaid flows. Use when deciding whether to deliver a deck as .pptx from
  Slidev or when judging whether the pipeline still meets its requirements. Not for implementation
  choices, library rationale, or internal behavior (see the spec), and not for Marp decks, which
  go through marpx instead.
status: stable
verified_at: 2026-09-07
applies_to: [slidev@52.19, playwright@1.63, python-pptx@1.0, node@22, python@3.12]
sources:
  - https://sli.dev/
  - https://python-pptx.readthedocs.io/
---

# Slidev から編集可能な PPTX への変換の要件

内部の挙動と実装判断は [10_spec/slidev-pptx.md](../10_spec/slidev-pptx.md) にある。ここには外から観測できることだけを書く。

## 背景

スライドの提出物が PowerPoint 指定のことがある。ブラウザ用のスライドツールから PPTX に出すと、
たいていスライドが 1 枚の画像になり、渡した先で直せない。直せない資料は渡した時点で死ぬ。

Marp からの変換は [marpx の手順](../../knowledge/workflow/marpx-editable-pptx-from-marp.md)で足りているが、
marpx は「出てきた HTML と CSS を後から解釈する」作りなので、作者が観測していないレイアウトでは黙って画像に落ちる。
何が編集可能になるかを書く前に決めておきたい。

## 外部要求 (EARS)

| ID | 型 | 要求 |
|---|---|---|
| REQ-SPX-01 | ユビキタス | 変換は、Slidev のデッキから PowerPoint が編集できる .pptx を作ること |
| REQ-SPX-02 | ユビキタス | 変換は、利用者に対して「デッキを読み取る」と「PPTX を組み立てる」の 2 つの入口を提供し、その間を 1 つの JSON ファイルで受け渡すこと |
| REQ-SPX-03 | ユビキタス | 変換は、スライドの要素が PPTX でどの図形になるかを、利用者が Vue コンポーネントで宣言できるようにすること |
| REQ-SPX-04 | ユビキタス | 変換は、使える図形の一覧を利用者に示し、一覧に無い図形を受け付けないこと |
| REQ-SPX-05 | イベント駆動 | 図形を宣言していない見出し・段落・箇条書き・表を渡されたとき、変換は、それらをテキストボックスとして出力に含めること |
| REQ-SPX-06 | オプション | 宣言した要素だけを出力する場合、変換は、それを選べる指定を受け付けること |
| REQ-SPX-07 | ユビキタス | 出力する .pptx は、画像として指定した要素を除き、文字と図形をすべて PowerPoint 上で編集できる形で持つこと |
| REQ-SPX-08 | ユビキタス | 出力する .pptx は、スライドの縦横比を利用者が指定した値にすること |
| REQ-SPX-09 | イベント駆動 | 読み取りに成功したとき、変換は、スライドごとの図形の数を利用者に伝えること |
| REQ-SPX-10 | イベント駆動 | 組み立てに成功したとき、変換は、出力先・スライド数・置いた図形の数を伝え、終了コード 0 で終わること |
| REQ-SPX-11 | 望ましくない挙動 | もし一覧に無い図形が指定されているならば、変換は、その図形の名前を示す警告を出し、矩形として出力を続けること |
| REQ-SPX-12 | 望ましくない挙動 | もし入力の JSON が存在しない、読めない、またはスライドを 1 枚も含まないならば、変換は、何も出力せず、理由を示して終了コード 1 で終わること |
| REQ-SPX-13 | 望ましくない挙動 | もし読み取り対象にスライドが 1 枚も無いならば、変換は、確かめるべき場所を示して失敗すること |
| REQ-SPX-14 | ユビキタス | 変換は、外部への通信をせずに完了すること |

## ハッピーパス

スライドを書くまで。

```mermaid
flowchart LR
  A[伝えたい図] --> B[図形の Vue コンポーネントで組む]
  B --> C[pnpm dev でブラウザで確認]
  C --> B
```

PPTX にして渡すまで。

```mermaid
flowchart LR
  D[pnpm deck で読み取る] --> E[shapes.json]
  E --> F[pnpm pptx で組み立てる]
  F --> G[PowerPoint で開いて直す]
```

## 適用範囲外

- **Marp のデッキは対象外。** Marp からは [marpx の手順](../../knowledge/workflow/marpx-editable-pptx-from-marp.md)を使う
- **アニメーションと画面遷移は移せない。** Slidev の `v-click` は最終状態だけが出る
- **グラデーション・影・角丸以外の装飾は落ちる。** 移すのは単色の塗りと単色の枠線まで
- **画像は編集できない。** 画像として宣言したものは PPTX でも画像になる
- スピーカーノートは移さない

## 受け入れ条件

- `pnpm deck` が終了コード 0 で完了し、スライドごとの図形の数を表示して `shapes.json` を作る
- `pnpm pptx shapes.json -o out.pptx` が終了コード 0 で完了し、`wrote: ... slides=N shapes=M` を返す
- 出力を読み戻したとき、図形の種類・位置・大きさ・文字・色が元のスライドと対応している
- 一覧にあるすべての図形を 1 度ずつ使ったデッキが、画像を 1 つも含まずに変換できる
