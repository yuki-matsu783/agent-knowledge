---
type: requirement
title: 構成図生成 (archify) の要件
description: >-
  External requirements in EARS form for producing large diagrams for this repository: the command
  the author calls, what counts as the source of truth, when a diagram is rejected, where the
  artifacts live, and which diagrams belong to mermaid instead. The happy path is drawn as small
  mermaid flows. Use when deciding whether a diagram belongs here or when judging whether the
  pipeline still meets its requirements. Not for procedures or internal behavior (see the spec).
status: verified
verified_at: 2026-09-05
applies_to: [archify@2.17.0-dev.1, node@22.15]
sources:
  - https://github.com/tt-a1i/archify
  - ../../../templates/archify/README.md
---

# 構成図生成 (archify) の要件

内部の挙動と実装判断は [10_spec/archify-diagrams.md](../10_spec/archify-diagrams.md) にある。ここには外から観測できることだけを書く。

## 背景

knowledge の図が大きくなると mermaid では読めなくなる。ノードが 8 個を超えたあたりから線が交差し、境界を描けず、どれが主経路か分からない。
かといって作図ツールで手描きすると、図と本文がずれても誰も気づかない。図も本文と同じく検証できる必要がある。

## 外部要求 (EARS)

| ID | 型 | 要求 |
|---|---|---|
| REQ-DIA-01 | ユビキタス | 図生成は、図の正を型付き JSON として受け取り、HTML を出力すること |
| REQ-DIA-02 | ユビキタス | 図生成は、利用者に対して `pnpm diagrams` という単一の入口を提供すること |
| REQ-DIA-03 | イベント駆動 | 図の生成を要求されたとき、図生成は、出力の前にその図を検証すること |
| REQ-DIA-04 | 望ましくない挙動 | もし検証に 1 件でも error があるならば、図生成は、HTML を出力せず、診断内容を示して終了コード 1 で終わること |
| REQ-DIA-05 | イベント駆動 | 検証に通ったとき、図生成は、入力と同じ場所に HTML を出力し、通過したチェック数を利用者に伝えること |
| REQ-DIA-06 | 望ましくない挙動 | もし図生成に必要な環境が整っていないならば、図生成は、対処方法を示し、何も出力せずに終了コード 1 で終わること |
| REQ-DIA-07 | ユビキタス | 図生成は、外部への更新チェック通信を行わないこと |
| REQ-DIA-08 | オプション | 検証だけを行う場合、図生成は、`--check` により HTML を書かずに判定のみ返すこと |
| REQ-DIA-09 | オプション | 対象を絞る場合、図生成は、引数で指定した JSON だけを扱うこと |
| REQ-DIA-10 | ユビキタス | 完成した図は、JSON と HTML が `knowledge/diagrams/` に並び、knowledge の本文から相対パスでリンクされていること |

## ハッピーパス

図種を決めて JSON を用意するまで。

```mermaid
flowchart LR
  A[図が要る] --> B[図種を選ぶ]
  B --> C[テンプレートを複製]
  C --> D[ラベルとカードを差し替え]
```

検証して成果物にするまで。

```mermaid
flowchart LR
  E[pnpm diagrams --check] --> F[checks=9 が ok]
  F --> G[pnpm diagrams で HTML 生成]
  G --> H[knowledge から相対リンク]
```

mermaid と archify の使い分け。

```mermaid
flowchart LR
  X[図の規模] --> Y[5 ノード程度<br/>簡単なフロー]
  X --> Z[8 ノード以上<br/>境界・主経路・差分]
  Y --> Y2[mermaid を本文に書く]
  Z --> Z2[archify で生成]
```

## 適用範囲外

archify 自身がスコープ外と明記しているもの。ここに当てない。

- Mermaid の自動パース、汎用オートレイアウト、ホスティング共有、WYSIWYG 編集
- 稼働中インフラの検査。書かれていないことは描かない (fail closed)
- 見た目の良し悪しの判定。検証は決定的な検査だけで、読みやすさは人が見る
- locale は en と zh-CN のみ。ラベルは入力した文言がそのまま出るので日本語は書ける

## 受け入れ条件

- `pnpm diagrams --check <file>` が `ok: ... checks=9` を返す
- 生成 HTML をブラウザで開き、ラベルの重なりと主経路が目で追える
- JSON は `knowledge/diagrams/<slug>.<kind>.json`、HTML は同じ場所に置き、knowledge の本文から相対パスでリンクした
