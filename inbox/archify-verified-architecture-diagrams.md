---
type: note
title: archify で検証付きの構成図を生成する
description: >-
  Unverified note on archify, a Node-based agent skill that compiles typed JSON diagram IR into
  self-contained HTML/SVG only after schema, layout, and route validation pass. Use when a knowledge
  file needs an architecture, workflow, sequence, data-flow, or lifecycle diagram too large for
  mermaid, or when a diagram must be diffed between versions. Not for simple diagrams that render
  fine as mermaid in GitHub, and not for WYSIWYG editing or hosted sharing, which archify declares
  out of scope.
tags: [workflow, meta, claude-code]
keywords: [archify, 構成図, アーキテクチャ図, シーケンス図, データフロー, 検証ゲート, JSON IR, mermaid, d2, diagram-design, skills, ローカルインストール, pnpm dlx]
status: outdated
verified_at: 2026-09-05
superseded_by: .claude/docs/10_spec/archify-diagrams
sources:
  - https://github.com/tt-a1i/archify
---

# archify で検証付きの構成図を生成する

> この知識は superseded_by のドキュメント ([.claude/docs/10_spec/archify-diagrams.md](../.claude/docs/10_spec/archify-diagrams.md)) により無効。要件は [.claude/docs/00_requirement/archify-diagrams.md](../.claude/docs/00_requirement/archify-diagrams.md)、検証済みテンプレート 7 本と手順は spec 側にある。

## 位置づけ

archify はエージェントが書いた型付き JSON (中間表現) を、スキーマ・レイアウト・経路・ラベル干渉の検証を通過した場合にだけ HTML / SVG にコンパイルする。「絵を描く AI」ではなく「設計データを検証してから図にするコンパイラ」。Mermaid のテーマでも汎用作図ツールでもない、と README が明記している。

## このリポジトリでの導入

グローバルではなくプロジェクトローカルに複製した (.claude/skills/archify)。

```sh
pnpm dlx skills add tt-a1i/archify --skill archify --agent claude-code --copy --yes
```

- 更新通知の外部通信は `.claude/settings.json` の `ARCHIFY_UPDATE_CHECK_DISABLED=1` で止めている
- `skills-lock.json` がリポジトリ直下に生成される (skills CLI のロックファイル)

## 図種の使い分け (README より)

| 図種 | 対象 |
|---|---|
| Architecture | コンポーネント、サービス、ストレージ、境界 |
| Workflow | CI/CD、承認フロー、ツール呼び出し |
| Sequence | API 呼び出し、フォールバック、認証、非同期トレース |
| Data Flow | パイプライン、リネージ、PII の流通 |
| Lifecycle | 状態、リトライ、待機、終端 |

## 直接叩くコマンド (README より、未検証)

```sh
node .claude/skills/archify/bin/archify.mjs doctor
node .claude/skills/archify/bin/archify.mjs guide "Show CI/CD checks, approval, deploy, and rollback"
node .claude/skills/archify/bin/archify.mjs validate architecture foo.architecture.json --json
node .claude/skills/archify/bin/archify.mjs deliver architecture foo.architecture.json foo.html --quality showcase --json
```

## 制約 (README より)

- スコープ外: Mermaid の自動パース、汎用オートレイアウト、ホスティング共有、WYSIWYG 編集
- locale は en と zh-CN のみ。ラベルは入力した文言がそのまま出るので日本語は書ける
- 書かれていないことは描かない (fail closed)。稼働中インフラの検査もしない

## mermaid との使い分け

- 5 ノード程度、状態遷移、簡単なフロー → mermaid (GitHub でそのまま描画)
- コンポーネント 8 個以上、境界と主要経路、差分追跡が要る → archify

## 昇格チェック

- [ ] type を決めた (how-to になる見込み)
- [ ] sources に一次情報がある (README のみ)
- [ ] applies_to に検証したバージョンがある
- [ ] 実際に 1 枚生成して verified_at を書ける
