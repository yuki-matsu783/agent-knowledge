---
type: note
nature: fact
title: PermissionRequest hook が timeout しても通常の permission flow に戻るだけで素通りにはならない
description: >-
  Notes, from the official hooks reference, that a Claude Code PermissionRequest hook which times
  out, exits non-zero, or returns no decision does not approve anything: the tool call falls back to
  the normal permission flow, which is the human prompt in default mode and a denial in sessions that
  cannot show a prompt. Contrasts this with PreToolUse, where a stalled hook fails open, and draws the
  consequence that an LLM-backed approver (a prompt or agent hook, or a command hook calling a model
  CLI) is acceptable on PermissionRequest even though it is not acceptable as a PreToolUse guard.
  Use when deciding where to put an automatic approver. Not measured in this repository, and not
  applicable in auto or bypassPermissions mode where the event never fires.
tags: [claude-code, security, workflow]
keywords:
  - PermissionRequest
  - timeout
  - fail-open
  - fail-closed
  - permission flow
  - 承認
  - LLM に承認判断
  - prompt hook
  - agent hook
  - PreToolUse との違い
  - auto mode
  - bypassPermissions
  - 非対話
  - deny
  - decision prompt
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
---

# PermissionRequest hook が timeout しても通常の permission flow に戻るだけで素通りにはならない

## 公式の記述

hooks リファレンス (2026-09 時点) は PermissionRequest について次を書いている。

- hook が exit 0 で JSON を出さない、0 と 2 以外で終わる、timeout する、のどれでも「通常の permission flow に進む」。default モードなら人にプロンプトが出る
- exit 2 はこのイベントでは block として扱われない。permission flow はそのまま進む
- プロンプトを出せないセッション (`-p` の背景サブエージェントなど) でも hook は走り、**どの hook も decision を返さなければ deny** になる
- `auto` モードと `bypassPermissions` モードでは発火しない。既に rule か前の hook で decision が付いている呼び出しでも発火しない

つまり PermissionRequest の hook が黙ると、対話では人に、非対話では deny に倒れる。
[PreToolUse の timeout が素通りになる](../common/hook-timeout-fails-open.md) のとは逆向きで、hook が壊れても権限が広がることはない。

## 設計への含み

PermissionRequest は**「人が Yes と言うはずの呼び出しを、人の代わりに Yes と言う」場所**で、ガードではない。rule で allow 済みの呼び出しは通らないし、deny できるのは本来プロンプトが出る呼び出しだけ。

このため [LLM を呼ぶ hook をガードにしない](../common/hook-timeout-fails-open.md) という原則の例外になる。参考にした実践報告 (Claude Code の作者の tips) の「承認要求を上位モデルに判断させる hook」は、
PreToolUse に置けば遅延が許可に化けるが、PermissionRequest に置けば遅延は「人に聞く」に化けるだけで、被害は待ち時間で済む。

ただし待ち時間は既定で長い。command hook の既定 timeout は 600 秒なので、`timeout` を書かずに LLM を呼ぶと、詰まった回はプロンプトが出るまで最長 10 分止まる。
`timeout` を数十秒にし、hook 側で応答が無いときは `decision: "prompt"` を明示して返す方が、黙って倒れるより挙動が読める。

deny 側は `interrupt: true` を付けると agentic loop ごと止まる。付けなければ Claude は deny を見て別の手を試す。

## 確かめていないこと

- 実際に timeout する PermissionRequest hook を登録して、拡張で人へのプロンプトに戻ることを見ていない
- `-p` の背景サブエージェントで deny になる挙動
- `decision: "prompt"` を返したときと、何も返さないときの UI 上の違い
- `updatedPermissions` でセッション中に allow を足したとき、次回から PermissionRequest が発火しなくなるのか

## 昇格の目安

- [ ] 粒度が `pitfall` か `pattern` に収まっている (「timeout の倒れ方」だけなら pitfall、「承認を hook に任せる」なら pattern に分かれる)
- [x] sources に一次情報がある
- [ ] 実際に試して applies_to と verified_at を書ける
