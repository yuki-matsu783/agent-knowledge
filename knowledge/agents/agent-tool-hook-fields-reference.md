---
type: reference
nature: fact
title: Agent ツール周りの hook 入出力はイベントごとにフィールドの有無と命名が異なる
description: >-
  A field-level reference for hooks that observe Claude Code subagents: which events carry `model`
  (SessionStart only; SubagentStart never), when PreToolUse Agent's `tool_input.model` is present (only
  if the caller passed it), that PostToolUse Agent's `tool_response` uses camelCase (`agentId`, `status`,
  `resolvedModel`) while event input uses snake_case (`agent_id`, `agent_transcript_path`), that
  SubagentStop output does not reach the parent so PostToolUse Agent is the channel back, that
  PostToolUse fires only on success and Bash's tool_response has no exit code (failures go to
  PostToolUseFailure with `error` starting "Exit code N"), and that tool calls inside a subagent carry
  `agent_id` / `agent_type`. Use when a subagent-related hook reads a field that is always null. Not
  for the general hook event list or the JSON output schema.
tags: [claude-code, multi-agent, observability]
keywords: [Agent ツール, hook, SubagentStart, SubagentStop, PreToolUse Agent, PostToolUse Agent, tool_input.model, resolvedModel, agentId, agent_id, camelCase, snake_case, status, async_launched, PostToolUseFailure, exit code, Exit code N, tool_response, jq null]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/sub-agents
stale_after: 2027-03-05
---

# Agent ツール周りの hook 入出力の一覧

## 対象

Claude Code 2.1 系 (2026-09 時点) の hooks リファレンスと、サブエージェントを監視する hook 群を実装して実測した結果から、
「サブエージェントに関する情報がどのイベントのどのフィールドに来るか」を 1 か所にまとめた。存在しないキーを `jq` で引いても `null` が返るだけでエラーにならないので、
取り違えると「常に縮退」「常に一致」という一貫した誤りになり、テストを書かない限り気づけない。

## 一覧

| 知りたいこと | 来る場所 | 来ない場所・注意 |
|---|---|---|
| 起動しようとしているサブエージェントの種類 | PreToolUse `Agent` の `tool_input.subagent_type` | SubagentStart にも `agent_type` が来る |
| 起動に指定されたモデル | PreToolUse `Agent` の `tool_input.model`。**呼び出し側が明示したときだけ**入る (実測)。省略時はキーごと無く、既定モデルで走る | SubagentStart には `model` は**来ない**。公式: "Only `SessionStart` hooks can receive a `model` field, and Claude Code doesn't always include it." |
| 実際に使われたモデル | PostToolUse `Agent` の `tool_response.resolvedModel` (実測で実在を確認)。起動後の比較にはこちらが確実 | `tool_input.model` が無いことを「一致」と読まない |
| background か foreground か | PostToolUse `Agent` の `tool_response.status`: `completed` / `async_launched`。v2.1.198 以降は省略時 background | `tool_input.run_in_background` は公式の表に無い。`false` が明示されていなければ background とみなす |
| サブエージェントの識別子 | PostToolUse `Agent` の `tool_response.agentId` (**camelCase**)。SubagentStop の入力は `agent_id` (**snake_case**) | 同じものを指す名前が経路で違う。`agent_id // agentId` と両方試す書き方は、どちらが正かを仕様が決めていない状態を実装で埋めるので避ける |
| サブエージェントの transcript | SubagentStop の `agent_transcript_path`、`last_assistant_message` | |
| サブエージェント内のツール呼び出しであること | そのツール呼び出しの PreToolUse / PostToolUse 入力に `agent_id` / `agent_type` が付く (実測) | |
| サブエージェント終了後にメインへ何かを伝える | **PostToolUse `Agent` の `additionalContext`**。公式: "To inject context into the parent session after a subagent returns, use a `PostToolUse` hook on the `Agent` tool instead." | SubagentStop の出力はメインエージェントに届かない |
| 起動前にメインエージェントへ伝える | できない。PreToolUse の `additionalContext` はツール結果の隣に届く ("next to the tool result") | `systemMessage` はユーザー向けで、対話 UI での表示は環境依存 |
| ツールの成否 | PostToolUse は**成功時だけ**発火する。届いたこと自体が成功の証拠 | Bash の `tool_response` は `stdout` / `stderr` / `interrupted` / `isImage` で、**終了コードのフィールドは無い**。`exit_code` / `exitCode` / `returnCode` を順に読む実装は常に「無し」に落ちる |
| ツールの失敗 | PostToolUseFailure の `error` / `is_interrupt` / `duration_ms`。Bash なら `error` の 1 行目が `Exit code N` | 成功時の案内しか無い hook は PostToolUseFailure を登録しなくてよい |

`tool_response` のフィールドが camelCase なのは、ツールが返す値をそのまま渡す枠だから。イベントの共通入力 (`session_id` / `transcript_path` / `hook_event_name`) は hook の枠組みが決める snake_case。
どちらかに正規化するライブラリを挟むと、公式の名前と仕様書の名前が食い違い、原本と突き合わせるたびに変換が要る。公式の名前のまま扱う。

## 補足

- 起動前にモデルの不一致を止める設計は成り立ちにくい。`tool_input.model` が来ない起動が多く、来たとしても止める手段は `permissionDecision: "ask"` (ヘッドレスでは deny に化ける) か `continue: false` (セッション全体が止まる) しかない
- `permissionDecision` には `defer` という第 4 の値があるが、`-p` の非対話モードでしか効かず、対話セッションでは警告を出して無視される
- 「文書で解決した」項目でも、受け入れ条件が実物の確認を求めているなら実測は残す。`tool_response` に終了コードが無いことは文書で分かるが、実際に届く JSON を記録して確かめた

## 関連

- [サブエージェントは既定で background で走り PostToolUse Agent は起動直後に発火する](subagent-runs-in-background-by-default.md)
- [通知しなかった判定も skip として記録し記録の欠如を縮退と読めるようにする](../hooks/22-PostToolUse/record-skips-so-absence-means-degraded.md)。`agentId` で記録を引く側
- [サブエージェントのモデルは定義で固定せず呼び出し側に決めさせる](subagent-model-selection-by-orchestrator.md)
