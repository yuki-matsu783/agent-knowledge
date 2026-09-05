---
type: adr
title: セッション中の作業ファイルは wip/ に置き、コミットするものとしないものを分ける
description: >-
  Records the decision to keep session-local working files in a top-level wip/ directory, split into
  wip/tickets/ (committed: notes for the ticket being worked on) and wip/local/ (gitignored: flag
  files, counters, logs, intermediate output), with .gitignore defaulting to "not tracked" so a
  stray log cannot be committed by mistake. Use when a hook, script, or agent needs somewhere to
  write state during a session, or when deciding whether a working file belongs in git. Not for
  generated artifacts such as INDEX.md, index.jsonl, or built slides, which keep their existing
  homes, and not for knowledge content, which goes to knowledge/ or inbox/.
tags: [meta, workflow]
keywords: [wip, gitignore, 作業ファイル, セッション, フラグ, カウンタ, ログ, チケット, tickets, local, 一時ファイル, scratchpad, TMPDIR, SCOPE_DIRS, 引き継ぎ]
status: verified
verified_at: 2026-09-05
sources:
  - .claude/rules/directory-layout.md
  - scripts/lib/repo.ts
---

# セッション中の作業ファイルは wip/ に置き、コミットするものとしないものを分ける

## 状況

hook やスクリプトやエージェントは、セッションの途中で置き場所の無いファイルを作る。
ツール使用回数のカウンタ、次の `PreToolUse` に判断を渡すフラグ、監査のログ、調べ物の途中経過、
チケットの要件メモ。今までこれらに決まった置き場所が無く、`/tmp` かリポジトリ外の一時ディレクトリに散っていた。

問題は 2 つ。`git status` に現れないので消し忘れに気づけない。そしてセッションが終わると消えるので、
次のセッションや他の人に引き継げない。一方で全部コミットすると、ログとフラグがコミット履歴を汚す。

## 決定

トップレベルに `wip/` を作り、その中で git に載せるものと載せないものを分ける。

| 置き場所 | 中身 | git |
|---|---|---|
| `wip/tickets/` | 作業中チケットの情報 (要件メモ、調査ログ、TODO) | コミットする |
| `wip/local/` | フラグ用ファイル、カウンタ、ログ、実行の中間出力 | 追跡しない |

`.gitignore` は次のように書く。既定を「追跡しない」にして、`wip/tickets/` だけ戻す。

```gitignore
wip/*
!wip/tickets/
```

- `wip/local/` は追跡されないので clone 直後には存在しない。書く側が `mkdir -p wip/local` してから書く
- `wip/` は lint と index の対象外 (`scripts/lib/repo.ts` の `SCOPE_DIRS` は knowledge / inbox / adr / slides)。
  frontmatter は要らない
- チケットが終わったら `wip/tickets/` の中身を消すか、残す価値があるなら knowledge か inbox へ移す

## 却下した案

| 案 | 却下した理由 |
|---|---|
| `/tmp` やエージェントの scratchpad ディレクトリに置く | `git status` に現れず消し忘れに気づけない。セッションが終わると消えるので引き継げない |
| `.claude/state/` に置く | `.claude/` は規約と skill の置き場所で、実行時の状態が混ざると設定の差分が読めなくなる。lint 対象外という点も紛らわしい |
| `wip/` を丸ごと gitignore する | チケットの要件メモを共有できない。結局 knowledge/ に未整理のまま置くことになる |
| `wip/` を丸ごとコミットする | ログとフラグが履歴に入る。カウンタファイルは毎ツール呼び出しで変わるので差分が常に汚れる |
| 既定を追跡にして `wip/local/` だけ無視する (`wip/local/`) | 取り違えて `wip/` 直下に置いたログがコミットされる。事故の向きが逆なので、既定は無視側にした |
| ディレクトリを分けずファイル名の接頭辞で区別する | `.gitignore` が glob の書き分けになり、増えるたびに規則が壊れる |
| `wip/` を lint と index の対象に加える | 途中の下書きに frontmatter を求めることになり、書き捨てられなくなる |

## 影響

- hook とスクリプトが状態を持つときの書き先は `wip/local/`。パスは相対ではなくリポジトリルート基準で解決する
- `wip/local/` を守りたいガード (エージェントに消させたくないフラグ) は、置いただけでは守れない。
  permissions.deny か protected paths を併せて掛ける ([ガードの設定と hook 自身をエージェントから守る](../knowledge/protect-guard-config-from-the-agent.md))
- `wip/tickets/` に置いたメモは知識ではない。knowledge/ の昇格条件を満たしたものだけを inbox/ か knowledge/ へ移す
