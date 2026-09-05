---
type: pattern
nature:              # fact | finding | insight | heuristic | best-practice | principle | opinion (taxonomy.yml、判定は .claude/rules/knowledge-authoring.md)
title:               # パターン名
description: >-   # 英語。What / Use when ... / Not for ... を 2〜4 文で (規約: .claude/rules/markdown-frontmatter.md)
  
tags: []             # taxonomy.yml の語彙から 2〜4 個
keywords: []         # 検索用の語を 3〜20 個
status: stable       # stable | deprecated
verified_at:         # YYYY-MM-DD (verified にするとき)
stale_after:         # YYYY-MM-DD。製品の版で変わりうる挙動なら verified_at + 6 か月 (任意)
applies_to: []       # 例 agent-sdk@0.1
sources: []          # 一次情報の URL
intervention:        # prompt | tool | hook | human (対策の層。任意)
---

# (title と同じ)

## 課題

どういう状況で何に困るか。

## 解決

パターンの中身。構造が要るなら mermaid で書く。

## 適用条件

このパターンが効く条件と、効かない条件。

## トレードオフ

得るものと失うもの。

## 関連

- (関連する pitfall / concept への相対リンク)
