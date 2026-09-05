---
type: pitfall
nature: fact
title: サブエージェントは既定で background で走り PostToolUse Agent は起動直後に発火する
description: >-
  Explains that since Claude Code v2.1.198 an `Agent` call without `run_in_background` launches the
  subagent in the background, the tool returns immediately, and the PostToolUse hook on `Agent` fires
  at launch with `tool_response.status` = "async_launched" (measured), not after the subagent finished.
  A hook that inspects the working tree there "after the subagent's work" sees the tree before any
  work and reports "nothing wrong", which is worse than reporting nothing. Use when designing a
  PostToolUse Agent or SubagentStop hook that checks results, or when such a hook never finds anything.
  Not for how to pick foreground versus background for a task, and not for Agent SDK subagents.
tags: [claude-code, multi-agent]
keywords: [サブエージェント, Agent ツール, run_in_background, background, 既定, v2.1.198, PostToolUse, async_launched, completed, tool_response.status, 起動直後に発火, 作業後の検査, 該当なし, 誤った安心, SubagentStop, resolvedModel]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/sub-agents
stale_after: 2027-03-05
---

# サブエージェントは既定で background で走り PostToolUse Agent は起動直後に発火する

## 症状

「サブエージェントが走り終わった後に、作業中のまま残ったチケット・未コミットの差分・範囲外の差分を検査してメインエージェントに伝える」hook を
PostToolUse の `Agent` matcher に置いた。ところが検査は常に「該当なし」で、しかもそれが**問題が無かった**と伝わる。

## 原因

公式の `Agent` ツールの `tool_response` の説明にこうある。

> `"completed"` for foreground subagents, `"async_launched"` for background subagents. As of v2.1.198, subagents run in the background by default, so an omitted `run_in_background` also produces `"async_launched"`.

> For background subagents, the tool returns when the task moves to the background … a background launch returns immediately

つまり既定では PostToolUse `Agent` は「走り終わった後」ではなく**起動した直後**に発火する。作業後の検査はサブエージェントが何もしていない作業ツリーを見る。
実測でも対話セッションで `run_in_background` を省略して起動すると `tool_response.status` は `async_launched` だった。

`tool_input` に `run_in_background` は公式の表に無い (`prompt` / `description` / `subagent_type` / `model` だけ)。省略時が background なので、**`false` が明示されていなければ background として扱う**。

## 回避策

- PostToolUse `Agent` の hook は `tool_response.status` で分岐する。`completed` なら作業後の検査を行う。`async_launched` なら**検査を行わず、「background 起動なので完了後の検査は届かない。`run_in_background: false` で起動し直すか、完了を確かめてから自分で作業領域を確認すること」と伝える**。
  「該当なし」を返さないことが要点。検査できない状況で「問題なし」と伝えるのは、何も伝えないより悪い
- status が想定外の値のときは `completed` 側に倒さない (検査しない側が安全側)
- 起動前の PreToolUse `Agent` で、タスクの実施者を background で起動しようとしていることを通知する (起動は止めない)。既定は Claude Code 側の仕様で機構が変えられるものではない
- SubagentStop 側の記録は background でも残るので、後から人間や次のセッションが読める。届かないのは「その場でメインエージェントに」だけ
- 逆に**起動の事実に関する通知** (実行者のモデルが計画と違う、など) は起動直後に発火する方が有利。サブエージェントがほとんど動かないうちに気づける。
  比較の材料は `tool_response.resolvedModel` にあり (実測)、`tool_input.model` は呼び出し側が明示したときしか来ないので、起動後の方が確実

## 再現条件

claude-code v2.1.198 以降。実測は VSCode 拡張の対話セッションで `run_in_background` 省略時の PostToolUse `Agent` 入力を記録した。
それ以前の版では foreground が既定だったので、同じ hook が正しく動いていた可能性がある。仕様に版を書く。

## 関連

- [Agent ツール周りの hook 入出力の一覧](agent-tool-hook-fields-reference.md)。`status` / `agentId` / `resolvedModel` の名前と、どのイベントに何が来るか
- [通知しなかった判定も skip として記録し記録の欠如を縮退と読めるようにする](../hooks/record-skips-so-absence-means-degraded.md)。起動前の経路が使えないときの補い方
- [並列で走らせるエージェントは git worktree で隔離する](parallel-agents-isolated-by-worktree.md)
