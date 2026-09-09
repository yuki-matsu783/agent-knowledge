---
type: pitfall
nature: finding
title: settings.json の hook 登録を書き換えた tool use には書き換え前の PostToolUse が発火した
description: >-
  Records that when a tool call itself rewrites the PostToolUse entries in settings.json, Claude Code
  still fires the hooks that were registered before that edit for that same tool call, and the new
  registration only takes effect from the next tool call onward. The official docs say hook edits are
  "picked up automatically by the file watcher" but do not say at what granularity, so the useful
  boundary is the tool call, not the file write. Use when reasoning about an agent that edits its own
  hook configuration: whether a logging hook still sees the edit that removes it, or whether a hook you
  just added will observe the write that added it. Not a statement about PreToolUse, about other events,
  or about edits made from outside the session, none of which were checked.
tags: [claude-code, security, observability]
keywords: [settings.json, PostToolUse, hook 登録, live reload, file watcher, 反映タイミング, 次のツール呼び出しから, 自己書き換え, ガード無効化, 書き換えの検知, Edit, Write, 粒度]
status: stable
verified_at: 2026-09-09
stale_after: 2027-03-09
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
---

# settings.json の hook 登録を書き換えた tool use には書き換え前の PostToolUse が発火した

## 症状

Claude Code (VS Code 拡張) で、ツール呼び出し 1 回が `settings.json` の PostToolUse の登録を書き換えたとき、
その書き換えを行ったツール呼び出しに対しては**書き換える前の登録**が発火した。新しい登録が効くのは次のツール呼び出しから。

つまり、ツール呼び出しの前後で見ると次のようになる。

| そのツール呼び出しの PostToolUse | 次のツール呼び出しの PostToolUse |
|---|---|
| 書き換え前の登録 | 書き換え後の登録 |

- PostToolUse hook を**外す**書き換えをしても、外した当のツール呼び出しは古い hook に記録される
- PostToolUse hook を**足す**書き換えをしても、足した当のツール呼び出しは新しい hook からは見えない

## 原因

公式の hooks リファレンスは「settings ファイルの hook を直接編集した場合は file watcher が自動で拾う」とだけ書いており、
それがどの粒度で効き始めるかには触れていない。実際に効き始める境界はファイルの書き込みではなくツール呼び出しの単位だった。
ツール呼び出しの開始時点で hook の登録が決まり、その呼び出しの PostToolUse まで同じものが使われていると読めるが、
どこで登録が確定しているのかは確かめていない。

## 回避策

- **hook を使って設定の書き換え自体を捕まえる設計は成り立つ。** ガードを外す書き換えでも、その書き換えを行ったツール呼び出しは
  古い登録で記録・判定される。「外された瞬間の 1 回」は取り逃がさない
- **逆に、hook を足した直後の 1 回は観測できない。** hook を有効化する処理と、それを検証する処理を同じツール呼び出しに入れない。
  有効化したあと別のツール呼び出しを 1 回挟んでから確かめる
- 「live reload だから外した瞬間から効かなくなる」は 1 ツール呼び出しぶん粗い。守りの設計をするときは
  「次のツール呼び出しから消える」で考える

## 再現条件

Claude Code 2.1 を VS Code 拡張で動かして観測した。書き換えたのは PostToolUse の登録。
PreToolUse をはじめ他のイベントで同じかは確かめていない。セッションの外 (別プロセスやエディタ) から書き換えた場合も確かめていない。

## 関連

- [ガードの設定と hook スクリプト自身はエージェントから守るべき](../20-PreToolUse/protect-guard-config-from-the-agent.md)。設定が live reload される前提の守り方
- [ガードの判定はスクリプト 1 箇所に集め settings.json には入口だけを置くべき](../common/guard-config-lives-in-one-script.md)。判定をスクリプトへ寄せた場合の反映タイミングは別に確かめる必要がある
- [同じイベントの hook は並列に走り settings.json の配列順は実行順ではない](../common/hooks-run-in-parallel-not-in-array-order.md)
