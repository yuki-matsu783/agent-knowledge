---
type: pitfall
nature: finding
title: Plan モードへ再突入したら同じ plan ファイルパスが提示され続けた
description: >-
  Explains a Claude Code plan-mode constraint: ExitPlanMode takes no plan argument and reads the file at the
  path the harness presents, and within one session every re-entry into plan mode presents the same path as
  the first time (a new session gets a new path), so a workflow that wants a separate plan per phase either
  overwrites the approved plan or needs a copy-and-restore dance. Use when designing a multi-phase workflow
  around the plan tool, or when a second EnterPlanMode in a session silently reuses the earlier file. Not for
  the content of plans, and not a bug report: the source project stopped fighting the constraint by using
  the plan tool once per issue and writing later phase plans as ordinary files.
tags: [claude-code, workflow]
keywords: [Plan モード, EnterPlanMode, ExitPlanMode, plan ファイル, ハーネス提示パス, 再突入, re-entry, 同じパス, plansDirectory, 全体作業計画, 個別作業計画, 【】, glob, 角括弧, core.quotepath]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
stale_after: 2027-03-05
---

# Plan モードへ再突入すると同じ plan ファイルパスが提示され続ける

## 症状

1 つの作業で Plan モードを 2 回使う設計 (調査計画と作業計画) にすると、2 回目の `EnterPlanMode` で 1 回目と同じ plan ファイルパスが提示され、
新しいパスは割り当てられない。「計画ごとに新しい plan ファイル名を使う」というルールと両立しない。計画の作られ方が 3 系統
(plan ツール、`plans/` へ直接作成、plan ツールのファイルを後から Edit) に散り、挙動が安定しなくなる。

## 原因

`ExitPlanMode` は `plan` 引数を取らず、ハーネスが「今回の plan ファイル」として提示するパスから内容を読む。同一セッション内では再突入しても
同じパスが提示される (2 回目の `EnterPlanMode` で実地確認済み)。新しいセッションでは新しいパスが提示される。

当初の回避策 (別名で本当の計画を書き、提示パスへ一時的に同じ内容を書いて `ExitPlanMode`、承認後に `git checkout --` で復元) は、
復元忘れで 1 回目の計画が壊れるリスクがあり、一時上書き分が git 履歴に残らない運用になっていた。次の回避策 (提示パスの旧内容を
`_actN` 付きの別名へ退避してから上書きするスクリプト) は動いたが、根本は制約に触れる設計そのものだった。

## 回避策

**制約を回避するのではなく、制約に触れない運用へ変える。**

- plan ツールの利用を「全体作業計画」の作成 1 回に限定する。単位は「セッションにつき 1 回」ではなく「**issue (ブランチ) につき 1 回**」。
  新セッションでは新パスが出るので、セッション単位にするとセッションを跨ぐたびに計画が増える。既にブランチに全体計画があれば Plan モードを使わない
- フェーズごとの個別計画は plan ツールを使わず、通常の Write / Edit で `plans/【種別】タスク内容.md` として作る
- 判定を機械化する: `plans/【*.md` に一致しないものが全体計画

囲み文字に ASCII の `[]` でなく全角 `【】` を使うのは、**ASCII の角括弧が bash の glob で文字クラスとして解釈される**ため。
未クォートの `plans/[調査]*.md` はマッチせずパターン文字列がそのまま返るが、`plans/【調査】*.md` は正常にマッチする。
全角文字は glob 特殊文字ではないので、クォート忘れという落とし穴が構造的に消える。

非 ASCII のファイル名を扱うなら `git diff --name-only` / `git status --porcelain` に `-c core.quotepath=false` を付ける。
既定では 8 進エスケープ + ダブルクォートで返り、人間にもスクリプトにも使えない文字列になる。`git ls-files -z` のような NUL 区切り出力は元から影響を受けない。

## 再現条件

Claude Code、2026-08 時点。`.claude/settings.json` の `"defaultMode": "plan"` で新セッションが Plan モードで始まる設定でも、それは新規作成の理由にならない。

## 関連

- [タスクの切れ目で /compact と /clear をユーザに依頼させる](../rule/ask-user-to-reset-context-at-task-boundaries.md)。セッションを切る運用と、issue 単位の計画判定の組み合わせ
