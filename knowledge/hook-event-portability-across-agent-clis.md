---
type: pitfall
title: ConfigChange と FileChanged に頼ったガードは他のエージェント CLI へ移植できない
description: >-
  Warns that a guard built on the Claude Code hook events ConfigChange and FileChanged has no
  counterpart in Gemini CLI or Google Antigravity, both of which expose only execution-loop events,
  so the same configuration cannot be carried across tools and the protection silently disappears.
  Use when a hook-based guard has to hold on more than one agent CLI, or when deciding which layer
  of a defense to build on. Not for Claude Code-only setups, where both events are worth using, and
  not a comparison of the tools' overall capabilities.
tags: [claude-code, security, workflow]
keywords: [ConfigChange, FileChanged, Gemini CLI, Antigravity, BeforeTool, PreToolUse, AfterTool, 移植性, 互換, hook イベント, hooks.json, .gemini/settings.json, decision deny, exit 2, 最小公倍数, 共通部分]
status: verified
verified_at: 2026-09-05
applies_to: [claude-code@2.1, gemini-cli@0.58, antigravity-cli@1.1.25]
sources:
  - https://code.claude.com/docs/en/hooks
  - https://geminicli.com/docs/hooks/reference/
  - https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md
  - https://antigravity.google/docs/hooks/
  - https://antigravity.google/docs/ide/hooks/
---

# ConfigChange と FileChanged に頼ったガードは他のエージェント CLI へ移植できない

## 症状

Claude Code で `ConfigChange` と `FileChanged` を使ってガードを組み、同じ考え方を Gemini CLI や Antigravity に持っていくと、その層だけが消える。
設定を移せないので警告も出ない。イベント名を書く場所自体が無く、静かに何も起きないまま「ガードがある」と思い込む状態になる。

## 原因

3 つのツールで hook イベントの設計思想が違う。Gemini CLI と Antigravity は**エージェントループの中の出来事しか扱わない**。
ディスク上のファイル変更や設定の再読み込みという、ループの外側の出来事を捕まえるイベントを持っていない。

| | Claude Code | Gemini CLI | Antigravity |
|---|---|---|---|
| イベント数 | 30 以上 | 11 | 5 |
| ツール実行前に止める | `PreToolUse` | `BeforeTool` | `PreToolUse` |
| 設定変更を捕まえる | `ConfigChange` | 無し | 無し |
| ファイル変更を監視する | `FileChanged` | 無し | 無し |
| 止められるイベント | 多数 | `BeforeTool` `AfterTool` ほか | `PreToolUse` のみ |

Gemini CLI のイベントは `BeforeTool` `AfterTool` `BeforeAgent` `AfterAgent` `BeforeModel` `BeforeToolSelection` `AfterModel` `SessionStart` `SessionEnd` `Notification` `PreCompress` の 11 種類。
Antigravity は `PreToolUse` `PostToolUse` `PreInvocation` `PostInvocation` `Stop` の 5 種類で、CLI 版と IDE 版で同じ。ブロックできるのは `PreToolUse` だけ。

## 回避策

**共通部分だけでガードの本体を組み、`ConfigChange` と `FileChanged` は Claude Code 限定の追加層として扱う。**
どのツールにもある「ツール実行前に止めて理由を返す」だけで組めば、設定は移せなくても設計は移せる。

- 拒否理由をエージェントに返す口はどれも持っている。Claude Code は `permissionDecisionReason`、Gemini CLI は `decision: "deny"` の `reason` (exit 2 なら stderr)、Antigravity は `decision: "deny"`。
  [権限は permissions.deny ではなく PreToolUse hook で止める](deny-by-hook-not-permissions.md) の「理由と代替を返す」はそのまま通用する
- [ガードの設定と hook スクリプト自身をエージェントから守る](protect-guard-config-from-the-agent.md) の 4 層のうち、**3 層目 (`ConfigChange` で設定変更の適用を止める) だけが Claude Code 専用**になる。
  他ツールで残るのは 2 層目のツール時点の deny と、4 層目の OS 権限と CI。移植を前提にするならこの 2 つを主にする
- Claude Code だけで使う設定なら両イベントとも使ってよい。移植性を理由に捨てる必要は無い。分けて書いておけば移すときに落とす箇所が分かる

## 再現条件

各ツールの公式ドキュメントのイベント一覧で確認した (2026-09-05)。一覧は網羅的に書かれており、該当するイベントは存在しない。

Gemini CLI にはもう 1 つ差がある。設定ファイルの watcher をそもそも持たないので、エージェントが `.gemini/settings.json` を書き換えても動作中のセッションに即座には反映されにくい。
ファイル監視の追加は未実装の feature request のまま。ただし「一部の設定は即時適用される」とされていてキーごとの一覧が無く、次のセッションでは確実に効くので、保証として当てにはしない。

## 関連

- [ガードの設定と hook スクリプト自身をエージェントから守る](protect-guard-config-from-the-agent.md)。4 層のどれが移植できるかはこちらの構成と対応する
- [権限は permissions.deny ではなく PreToolUse hook で止める](deny-by-hook-not-permissions.md)。共通部分で組む土台
- [タイムアウトした hook はガードにならず素通りする](hook-timeout-fails-open.md)
