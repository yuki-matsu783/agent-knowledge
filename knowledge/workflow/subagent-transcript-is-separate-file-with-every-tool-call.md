---
type: reference
nature: fact
title: サブエージェントの transcript は親とは別の subagents/agent-<id>.jsonl にツール呼び出しごと残る
description: >-
  Documents where Claude Code writes a subagent's transcript and what it contains, read from real
  session files of the VS Code extension (2.1.251 and 2.1.261): each Agent tool call gets
  `<project>/<session-id>/subagents/agent-<agentId>.jsonl` plus a small `.meta.json`, the JSONL holds
  every tool_use and tool_result of the child with `isSidechain: true` and `agentId`, and the parent
  transcript holds only the Agent tool_use and one tool_result (or an `async_launched` stub for
  background agents) with zero sidechain lines. Use when building a monitor, dashboard, or audit that
  must see what each subagent is doing, or when deciding whether tailing the parent JSONL is enough.
  Not a specification: the format is undocumented and was only read, not watched live, so write lag
  is inferred from timestamps.
tags: [claude-code, multi-agent, observability]
keywords:
  - transcript
  - JSONL
  - subagents
  - agent-<agentId>.jsonl
  - meta.json
  - agentId
  - isSidechain
  - spawnDepth
  - toolUseId
  - async_launched
  - toolUseResult
  - totalToolUseCount
  - totalDurationMs
  - ~/.claude/projects
  - サブエージェント
  - 監視
  - tail
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/sub-agents
  - knowledge/workflow/transcript-jsonl-is-append-only-across-compact.md
---

# サブエージェントの transcript は親とは別の subagents/agent-<id>.jsonl にツール呼び出しごと残る

## 対象

Claude Code の VS Code 拡張 2.1.251 で `Agent` ツールを使った 7 セッション (別リポジトリ) と、2.1.261 の本セッションの
`~/.claude/projects/<project>/` を読んだ。ファイルを後から読んだだけで、書き込みをリアルタイムに観測してはいない。

## 一覧

| 場所 / 項目 | 中身 | 備考 |
|---|---|---|
| `<project>/<session-id>.jsonl` | 親の transcript。`Agent` の `tool_use` と、その `tool_result` だけ | `isSidechain: true` の行は **0 件**。子のツール呼び出しはここに一切出ない |
| `<project>/<session-id>/subagents/agent-<agentId>.jsonl` | 子の transcript。1 行目は `type: user` で渡したプロンプト、以降は親と同じ形の `assistant` / `user` 行 | 全行に `isSidechain: true`、`agentId`、親と同じ `sessionId`。`Bash` / `Grep` / `Read` / `WebFetch` の `tool_use` と `tool_result` が 1 件ずつ残る |
| `<project>/<session-id>/subagents/agent-<agentId>.meta.json` | `agentType`、`description`、`toolUseId`、`spawnDepth`、(指定時のみ) `model` | 1 行の JSON。`toolUseId` が親の `tool_use.id` と一致するので、これで親子を結ぶ |
| 親の `tool_result` (同期) | `toolUseResult` に `status: "completed"`、`agentId`、`agentType`、`content`、`totalDurationMs`、`totalTokens`、`totalToolUseCount`、`usage`、`toolStats` | 集計値はここにしか無い。子の途中経過は無い |
| 親の `tool_result` (background) | `toolUseResult` に `isAsync: true`、`status: "async_launched"`、`agentId`、`outputFile`、`canReadOutputFile` | 起動直後 (観測では 2 秒後) に返る。完了は後で `queue-operation` と `attachment` の行として届く |
| 子の `assistant` 行 | `requestId`、`attributionAgent`、`effort`、場合により `slug` | 親側の `attributionSkill` に相当する帰属が agent 単位で付く |

## 補足

- **子のファイルの時刻は親の呼び出しと噛み合う。** 観測した 1 件では、子の 1 行目が親の `tool_use` の 2.2 秒後、子の最終行が親の `tool_result` の 41 ms 前。
  行の時刻が 3 分間に散らばっているので、実行中に追記されていると読める。ただし追記を tail で観測したわけではないので、
  遅れの実測は別に要る
- **親を tail するだけではサブエージェントの状態は分からない。** 「今どれが動いているか、詰まっていないか」を見るなら
  `subagents/` ディレクトリの出現を監視し、各 `agent-*.jsonl` の最終追記時刻を見る。
  [サブエージェントと全体進捗を VS Code 拡張で可視化する](../agents/subagent-progress-ui-in-vscode.md) の第一の不安はこれで解ける
- **`spawnDepth`** が入っているので、サブエージェントがさらにサブエージェントを起こす入れ子も同じ場所に並ぶと思われる (深さ 2 は未観測)
- `<session-id>/` の下には `tool-results/` もあり、大きいツール結果はそこへ逃がされる。`subagents/` と並ぶ
- 本セッション (2.1.261) の親 transcript には `type: "worktree-state"` の行もあり、`EnterWorktree` の出入りが `worktreePath`、`worktreeBranch`、
  `enteredExisting`、`originalCwd`、`preEnterOriginalCwd` で残る。cwd の移動は `type: "relocated"` の行
- 形式は非公開で、版で変わりうる。読む側は未知の `type` と未知のキーを黙って捨てる作りにする。
  [transcript JSONL は /compact を挟んでも追記専用](transcript-jsonl-is-append-only-across-compact.md) の前提はここでも同じ
