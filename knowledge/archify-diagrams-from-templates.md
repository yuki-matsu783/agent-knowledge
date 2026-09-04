---
type: how-to
title: archify のテンプレートから検証付き構成図を作る
description: >-
  How to produce a validated architecture, sequence, dataflow, lifecycle, or workflow diagram with the
  project-local archify skill by copying one of this repository's showcase-validated templates,
  editing labels, and running the validate/deliver pipeline through pnpm diagrams. Use when a
  knowledge file needs a diagram with more than a handful of nodes, boundaries, or a main path that
  mermaid renders poorly. Not for simple state or flow sketches that mermaid handles inline, and not
  a reference for archify's full JSON schema.
tags: [workflow, meta, claude-code]
keywords: [archify, 構成図, テンプレート, validate, deliver, showcase, JSON IR, pnpm diagrams, skills, ローカルインストール, mermaid, 交差, ラベル干渉]
status: verified
verified_at: 2026-09-05
applies_to: [archify@2.17.0-dev.1, node@22.15]
sources:
  - https://github.com/tt-a1i/archify
  - templates/archify/README.md
---

# archify のテンプレートから検証付き構成図を作る

## 前提

- archify はプロジェクトローカルの `.claude/skills/archify` にある (グローバルインストールしない)。無ければ以下で複製する

  ```sh
  pnpm dlx skills add tt-a1i/archify --skill archify --agent claude-code --copy --yes
  ```

- 更新通知の外部通信は `.claude/settings.json` の `ARCHIFY_UPDATE_CHECK_DISABLED=1` で止めている
- `node .claude/skills/archify/bin/archify.mjs doctor` が全項目 ok を返すこと

## 手順

1. [templates/archify/README.md](../templates/archify/README.md) の表から一番近いパターンを選ぶ。7 本とも showcase の 9 チェックを error 0、warning 0 で通している。
2. `knowledge/diagrams/<slug>.<kind>.json` にコピーする。kind はファイル名末尾で判定される。
3. `meta.title`、ノードの `label` / `sublabel` / `tag`、`cards`、`views[].note` を差し替える。ID を変えるなら `from` / `to` / `focus` / `mainPath` も揃える。
4. ノード数を変えない限り座標は触らない。変えたら 1 つずつ検証する。

   ```sh
   pnpm diagrams --check knowledge/diagrams/<slug>.<kind>.json
   ```

5. HTML を生成し、本文から相対パスでリンクする。

   ```sh
   pnpm diagrams knowledge/diagrams/<slug>.<kind>.json
   ```

## 確認方法

`pnpm diagrams --check` が `ok: ... checks=9` を返す。生成 HTML をブラウザで開き、ラベルの重なりと主経路の見やすさを目で確認する (deliver は決定的検査だけで、見た目の良し悪しは判定しない)。

## つまずきどころ

- **sequence の y 座標** は 160〜677 に収める。viewBox 高さを変えても上限は変わらない
- **lifecycle の待機・終端列** は主経路の `col N+2` の真下に置かれる。`waiting` の col 0 は主経路 col 2 の下。斜めに繋ぐ遷移は endpoint-side-direction で落ちる
- **dataflow の row** は 0〜4。5 以降は座標が NaN になる
- **workflow の交差** は診断の座標だけでは原因が分かりにくい。`meta.quality_profile` を一時的に `standard` にして `--layout-json` を付けるとノード矩形と経路の点列が取れる
- **architecture の境界に沿う経路** (container-border-run) は、境界の外側に 40px 以上離して迂回させる
- 直しても改善しないときは、ノードやエッジを減らす方が早い。archify の指針も「主経路 1 本、ノード 12 個まで、細部はカードへ」
