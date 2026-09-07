---
type: pattern
nature: heuristic
title: 編集可能な PPTX が要るスライドは、変換先の図形の語彙をコンポーネントにしてから書いた方がよさそう
description: >-
  A pattern for exporting browser-based slide decks to native, editable PowerPoint: instead of
  parsing whatever HTML and CSS the deck happens to produce, define the target format's shape
  vocabulary as authoring components first, so the deck can only contain shapes the converter
  already knows, and conversion degrades to a lookup with one warning for anything outside the
  table. Verified end to end on Slidev 52 with a Playwright extractor and python-pptx builder.
  Use when a deck must be handed over as .pptx and the recipient has to edit it, and you control
  how the deck is authored. Not for converting decks somebody else already wrote in free-form
  markdown (marpx covers Marp), and not when the deck only needs to be viewed.
tags: [workflow, meta]
keywords: [Slidev, PPTX, PowerPoint, 編集可能, Vue コンポーネント, python-pptx, Playwright, data 属性, 図形, 語彙, 変換, marpx, 引き当て, computed style, オーサリング]
status: stable
verified_at: 2026-09-07
stale_after: 2027-03-07
applies_to: [slidev@52.19, playwright@1.63, python-pptx@1.0, node@22, python@3.12]
intervention: tool
sources:
  - https://sli.dev/
  - https://python-pptx.readthedocs.io/
  - https://tech-lab.sios.jp/archives/53989
  - https://tech-lab.sios.jp/archives/53973
---

# 編集可能な PPTX が要るスライドは、変換先の図形の語彙をコンポーネントにしてから書いた方がよさそう

## 課題

ブラウザ用のスライドツール (Slidev、Marp) から PPTX に出すと、たいていスライドが 1 枚の画像になる。
渡した先で直せない資料は、渡した時点で死ぬ。

ネイティブの図形に変換する道具はある ([marpx](marpx-editable-pptx-from-marp.md) など) が、
どれも「出てきた HTML と CSS を後から解釈する」作りをしている。この向きには構造的な弱点がある。

- 書ける HTML は無限にあるのに、変換側が知っているのは作者が観測した範囲だけ
- 外れたときは黙って画像に落ちる。**変換してみるまで、何が編集可能になるか分からない**
- 対応を増やすには、変換側が CSS の組み合わせを 1 つずつ追いかけることになる

## 解決

向きを逆にする。**変換先 (PPTX) の図形の語彙を先に決め、それをオーサリングの部品として配る。**
スライドはその部品でしか書けないので、変換側が知らない形が入ってこない。

```mermaid
flowchart LR
  A[PPTX の図形の語彙] --> B[Vue コンポーネント]
  B --> C[スライドを書く]
  C --> D[ブラウザが組版する]
  D --> E[印の付いた要素を引き当てる]
  E --> F[ネイティブ図形の PPTX]
```

役割を 3 つに割り、重ならないようにするのが肝。

| 決めるもの | 担当 | 渡し方 |
|---|---|---|
| **どの図形になるか** | コンポーネント | DOM の `data-pptx` 属性 |
| **どこにどの大きさで出るか** | ブラウザ (Playwright) | 枠に対する比 (0..1) |
| **どう組み立てるか** | 変換スクリプト | 図形の対応表 |

位置をコンポーネントの引数で持たせないのが要点。それをやるとスライドツールのレイアウトを捨てて手作業になる。
組版はブラウザに任せ、結果の座標だけ読み取れば、書き味はそのままで PPTX の座標が手に入る。
色・文字サイズ・線幅も同じ理由で属性に持たせず computed style から読む。**見た目の正は CSS 側に残す。**

読み取りと組み立ての間に JSON を 1 枚挟むと、両者を別の言語で書ける。
Node 製ツールを呼ぶ読み取り側は TypeScript、pptx 生成は Python という[言語の使い分け](../../.claude/rules/scripting.md)にそのまま乗る。
この境界のおかげで、同じ組み立てスクリプトを Slidev 以外の出力にも使える。

実装は [templates/slidev-pptx/](../../templates/slidev-pptx/README.md)。仕様は [.claude/docs/10_spec/slidev-pptx.md](../../.claude/docs/10_spec/slidev-pptx.md)。

## 適用条件

効く条件。

- **スライドの書き方を自分で決められる。** 部品を配れることが前提
- 渡した先が中身を編集する。見るだけなら PDF か画像で足りる
- 図が「箱と線と文字」でできている。組織図、流れ図、比較表はこの範囲に入る

効かない条件。

- 他人がすでに素の markdown で書いたデッキを変換する。この場合は後から解釈する道具の方が早い
- 図の見た目そのものが主題 (グラデーション、影、凝った装飾)。移せるのは単色の塗りと単色の枠線まで
- アニメーションが意味を持つデッキ。最終状態しか移らない

## トレードオフ

得るもの。

- **何が編集可能になるかが、変換前に分かる。** 部品を使った要素は必ずネイティブ図形になる
- 取りこぼしが「対応表に無い名前」という 1 つの警告に集約される。黙って画像に落ちない
- 図形を増やすのは、CSS と対応表に 1 行ずつ足す作業になる

失うもの。

- **書き方に制約が入る。** 素の markdown で自由に書けなくなる。実装では、印の付いていない見出し・段落・箇条書き・表を
  テキストボックスとして自動で拾う逃げ道を足して、制約を「図形にしたいところだけ」に閉じ込めた
- **道具が重い。** ブラウザで組版させる以上 Playwright と Chromium が要る (約 110 MB)。Slidev と合わせて 650 パッケージ
- ブラウザの組版に依存するので、フォントが取れないと座標まで変わる。Web フォントを外から取る構成にしない

## 関連

- [Marp の markdown から編集可能な PPTX を作るには marpx を uv で入れ marp-cli を npx で先に温めるべき](marpx-editable-pptx-from-marp.md) —
  後から解釈する側の道具。すでに書かれた Marp のデッキにはこちらを使う
- 出発点として渡された 2 本の記事 (sources の tech-lab.sios.jp) は、この作業をした環境の egress proxy が塞いでいて読めていない。
  ここに書いたことは記事とは独立に、手元で 1 度確かめた結果
