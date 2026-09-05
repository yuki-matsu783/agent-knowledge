---
type: note
title: rules を固定フォーマットの唯一の正にし、レビューは関心事ごとのサブエージェントが横断的に読む
description: >-
  Design idea for review criteria in an agent-maintained repository: instead of a second checklist layer
  (REVIEW-POINTS.md per directory), give .claude/rules a fixed per-concern format (coding conventions,
  security, documentation, ...) so the same files serve both authoring (the agent reads them before writing)
  and review (one read-only subagent per concern reads every rule file and checks the change cross-cuttingly).
  Use when planning how an adversarial or self-review step should know what to check, or when a separate
  checklist starts drifting from the rules it mirrors. Not for the subagent mechanics themselves, which the
  adversarial-review pattern covers, and not verified: no repository has been run this way yet, and the rule
  format that makes a rule mechanically checkable is still to be designed.
tags: [claude-code, evaluation, workflow]
keywords: [rules, レビュー観点, チェックリスト, 唯一の正, 固定フォーマット, 関心事, コーディング規約, セキュリティ, サブエージェント, 横断的, REVIEW-POINTS, 二重管理, 敵対的レビュー]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# rules を固定フォーマットの唯一の正にし、レビューは関心事ごとのサブエージェントが横断的に読む

## 発端

元プロジェクトは敵対的レビューの観点を `REVIEW-POINTS.md` として各ディレクトリに置き、対象ファイルから祖先を遡ってマージする方式を採った。
`.claude/rules/` をそのまま観点に使う案は「rules は行動規約 (こう書く) であってチェックリスト (こうなっていないか) ではなく、粒度も文体も違う。
しかも常時読み込まれるのでレビュー用に絞って渡せない」として却下されている。

しかしこの却下理由は、rules のフォーマットが自由だったことに起因する。言い換えると、REVIEW-POINTS という層は
**rules と REVIEW-POINTS のすみわけを定義できなかったこと**から生まれた設計で、その結果 rules と観点表という 2 つの正ができ、
観点表から rules を参照して二重管理を避ける手当てが要る。ディレクトリ階層で観点を切る収集ロジックも要る。
すみわけを定義する代わりに、層を 1 つにしてしまえばこの問題は消える。

## 案

- **rules を関心事ごとに固定フォーマットで書く。** 例: コーディング規約、セキュリティ、ドキュメント規約、shell の既知の罠。
  各ファイルは「作成時に従う書き方」と「レビュー時に確認する項目」の両方として読める形にする
- **作成時**: エージェントは rules を単純に読む (今までどおり)
- **レビュー時**: 関心事ごとの読み取り専用サブエージェント (コーディング規約レビュー、セキュリティ確認、…) を用意し、
  それぞれが rules を**横断的に**読んで変更をチェックする。観点の軸をディレクトリではなく関心事に置く
- サブエージェントは独立コンテキストなので「常時読み込まれるから絞れない」問題は起きない。渡すのは diff と、その関心事に対応する rules

## 元の方式との違い

| | REVIEW-POINTS (元プロジェクト) | この案 |
|---|---|---|
| 観点の正 | 観点表 (rules を参照) | rules そのもの |
| 観点の軸 | ディレクトリ階層 | 関心事 |
| 収集 | 祖先を遡ってマージするスクリプト | 関心事ごとにサブエージェントを起動 |
| 増えるもの | ファイル種別 1 つ + 収集ロジック | サブエージェント定義 (関心事の数だけ) |

「観点は対象ディレクトリごとに違う」という元の動機は、rules の `paths` (どのファイルに効くか) で表現できる。

## 確かめていないこと

- 「作成時に従う」と「レビュー時に確認する」の両方に耐える rules のフォーマット。項目を機械的に列挙できる形 (箇条書き 1 項目 1 チェック等) が要るはず
- 関心事の分け方 (タクソノミ) を固定する必要があり、増やすときにサブエージェント定義も増える
- rules 全体を毎回サブエージェントへ渡すコスト。元プロジェクトは「無関係な観点を大量に渡すと注意が散る」ことを理由に階層で絞っていた

## 昇格の目安

- [ ] 粒度が type の定義に収まっている (pattern になる見込み)
- [ ] sources に一次情報がある
- [ ] 実際に試して applies_to と verified_at を書ける

## 関連

- [敵対的レビューは独立コンテキストの読み取り専用サブエージェントに切り出す](adversarial-review-in-isolated-subagent.md)。レビューを担うサブエージェントの作り
