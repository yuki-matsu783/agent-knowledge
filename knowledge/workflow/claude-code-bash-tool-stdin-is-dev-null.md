---
type: note
nature: finding
title: Claude Code の Bash ツールは stdin が /dev/null で GIT_EDITOR=true が入っていた
description: >-
  Records what the Claude Code Bash tool's child process actually sees, measured from inside the
  VS Code extension (2.1.261): stdin is /dev/null, neither stdin nor stdout is a TTY, GIT_EDITOR=true
  is injected by the harness, and PAGER, GIT_TERMINAL_PROMPT, CI and BASH_DEFAULT_TIMEOUT_MS are
  unset. Also confirms that settings.json `env` values reach the Bash tool. Use when deciding which
  interactive commands already fail fast and which still need env or hook guards. Not for the
  terminal CLI, the PowerShell tool, or Claude Code on the web, none of which were measured.
tags: [claude-code, tool-use]
keywords:
  - Bash ツール
  - stdin
  - /dev/null
  - TTY
  - GIT_EDITOR
  - GIT_TERMINAL_PROMPT
  - PAGER
  - BASH_DEFAULT_TIMEOUT_MS
  - settings.json env
  - 対話コマンド
  - 子プロセス
  - 環境変数
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/env-vars
  - https://code.claude.com/docs/en/settings
---

# Claude Code の Bash ツールは stdin が /dev/null で GIT_EDITOR=true が入っていた

VS Code 拡張 (2.1.261) の Bash ツールから次を実行して観測した (2026-09-05、Windows の Git Bash)。

```sh
[ -t 0 ]; [ -t 1 ]; ls -l /proc/self/fd/0; timeout 3 cat; echo "cat exit=$?"
env | grep -E '^(GIT_|PAGER|CI|TERM|EDITOR|BASH_)'
```

| 項目 | 観測値 |
|---|---|
| stdin | `/proc/self/fd/0 -> /dev/null`。`cat` は即 EOF で終了 (exit 0)。TTY ではない |
| stdout | TTY ではない。git は pager を起動しない |
| `GIT_EDITOR` | `true`。OS の環境変数、`~/.bashrc`、settings.json のどこにも無いのでハーネスが注入している |
| `TERM` | `xterm-256color` |
| `PAGER` `GIT_PAGER` `EDITOR` `CI` `GIT_TERMINAL_PROMPT` `GIT_ASKPASS` `GH_PROMPT_DISABLED` | 未設定 |
| `BASH_DEFAULT_TIMEOUT_MS` `BASH_MAX_TIMEOUT_MS` | 未設定 (ツールの既定 120 秒、上限 600 秒) |
| settings.json の `env` | 届く。この repo の `ARCHIFY_UPDATE_CHECK_DISABLED=1` が Bash ツール内で見えた |

## 何が既に止まり、何が止まらないか

stdin が `/dev/null` なので、stdin から読む対話は即 EOF で終わる。`read`、`npx` の確認、`-m` 無しの `git commit`
(`GIT_EDITOR=true` で即通る) は固まらない。

残るのは stdin 以外を待つもので、これらはツールのタイムアウトまで止まる。

- `/dev/tty` を直接開くもの。git の資格情報プロンプト (`GIT_TERMINAL_PROMPT=0` が無い)、ssh のパスワード、sudo、gpg の pinentry
- 終わらないもの。`tail -f`、`watch`、`top`、dev サーバー
- Windows の GUI プロンプト。資格情報マネージャのダイアログなど

Gemini CLI との対照と、足すべき層は [エージェントの shell ツールは対話を人に渡さず即失敗させるべき](fail-interactive-shell-commands-fast.md)。

## 確かめていないこと

- ターミナルの CLI と Claude Code on the web で stdin が同じく `/dev/null` か
- PowerShell ツール (説明文には `-NonInteractive` で stdin は null デバイスとある) の実測
- `GIT_EDITOR=true` の注入がどの版から入ったか

## 昇格の目安

- [ ] 粒度が type の定義に収まっている (reference か pitfall)
- [x] sources に一次情報がある
- [ ] CLI と web でも試して applies_to を広げられる
