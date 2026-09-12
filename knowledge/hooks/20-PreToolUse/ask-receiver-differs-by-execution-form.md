---
type: reference
nature: fact
title: PreToolUse の ask を誰が答えるかは実行形態で決まる
description: >-
  Lists what a Claude Code PreToolUse hook decision of "ask" does in four execution forms: the main
  agent, a foreground subagent, a background subagent, and a nested headless `claude -p` run. Measured
  on the VS Code extension: subagents are logged under the parent's session id and inherit its
  permission mode, so their approval dialog appears in the parent session and the user answers it
  interactively, while a headless run has nobody to ask and the call is denied. The hook decision is
  identical in all four; only the receiver and the shape of a rejection differ. Use when designing
  guard rules that return ask, or when deciding which work to hand to a subagent versus a nested
  headless session. Not for hook deny, which needs no answer, and not for the permissions allow/deny
  lists that are evaluated after the hook.
tags: [claude-code, multi-agent, security]
keywords: [PreToolUse, ask, permissionDecision, 承認ダイアログ, サブエージェント, Agent ツール, background, run_in_background, claude -p, headless, 非対話, permission_denials, session id, permission mode, auto, killed, Request interrupted by user for tool use, 親セッション]
status: stable
verified_at: 2026-09-12
stale_after: 2027-03-12
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/sub-agents
  - https://code.claude.com/docs/en/permission-modes
---

# PreToolUse の ask を誰が答えるかは実行形態で決まる

## 対象

Claude Code 2.1.235 (VS Code 拡張、Windows 10 の Git Bash) で、PreToolUse hook が `ask` を返したときに何が起きるかを実行形態ごとに並べる。
確かめたのは Bash の `curl` / `wget` を ask にするガードで、同じ 1 行 (`curl -sS -o /dev/null -w "%{http_code}" https://example.com`) を
形態だけ変えて実行し、hook 側の判定ログと結果を突き合わせた。

## 一覧

| 実行形態 | 承認ダイアログ | 承認したとき | 拒否したとき |
|---|---|---|---|
| メインエージェント | 親の画面に出る | 実行され、結果がそのまま返る | ツール 1 回が潰れ、指示待ちで止まる |
| フォアグラウンドのサブエージェント | 親の画面に出る | 実行され、結果はサブエージェントの中に返って作業が続く | `Agent` ツールの呼び出しごと中断され、サブエージェントの報告は返らない |
| バックグラウンドのサブエージェント | 親の画面に出る | 同上 | エージェントが `killed` で終わる |
| 非対話 (`claude -p`) | 出せない | — | 一律で拒否。ツールループは続き、セッションは正常終了する |

hook の判定そのものはどの形態でも同じ ask で、強制されている点も変わらない。違うのは受け手と、拒否が何を巻き込むかだけ。

## 補足

- **サブエージェントは独立したセッションではない。** hook の入力に来るセッション ID は親と同じで、permission mode も親のまま (親が auto なら auto)。
  独立したセッション ID と `default` モードになるのは、Bash ツールから起動した `claude -p` だけ
- **承認をメインエージェントが仲介することはない。** ダイアログは親のセッションに直接出て、承認の結果はサブエージェントの中へ返る。
  「サブエージェントの ask が拒否としてメインに差し戻り、メインが人に聞き直す」形にはならない
- **permission mode が auto でも ask のダイアログは出る。** 画面に出たことは人に確認してもらった。hook の ask は auto で握り潰されない
- **拒否の意味が形態ごとに違う。** メインだけが「止められた」という結果を受け取って次を判断できる。サブエージェントはフォアグラウンドもバックグラウンドも続きを考える機会が無く終わり、
  `claude -p` は拒否を受け取った上で別経路を探して続ける
- 一度きりの注入 (同じ注意書きを 1 セッション 1 回だけ出す類) を hook 側でセッション ID で数えると、サブエージェントは親と同じ ID なので新品の context に注意書きが届かない。
  エージェント単位で数えると、サブエージェントを出すたび同じ文面が繰り返される。どちらに倒すかは決めておく

## 関連

- [サブエージェントで承認を拒否すると対話にならずそのエージェントの作業が打ち切られる](../../agents/rejecting-ask-ends-the-subagent.md)
- [非対話セッションでは ask が拒否になってもツールループは止まらず別経路が試される](denied-tool-call-does-not-stop-the-headless-loop.md)
- [PreToolUse hook は permission の評価より前に走るので deny は全 mode で効く](hook-deny-runs-before-permission-modes.md)
- [Bash ツールから入れ子で起動した claude で親セッションのガードを突破できる](../common/nested-claude-p-does-not-inherit-parent-guards.md)
- [Agent ツール周りの hook 入出力はイベントごとにフィールドの有無と命名が異なる](../../agents/agent-tool-hook-fields-reference.md)
