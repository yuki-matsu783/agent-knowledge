---
type: pitfall
nature: fact
title: Gemini CLI の対話モードでは対話コマンドが pty の入力待ちで最長 5 分止まる
description: >-
  Explains why an interactive command (vim, ssh, `git commit` without -m) run through Gemini CLI's
  run_shell_command does not fail fast but sits waiting for a human, because the TUI executes
  commands in a real node-pty (tools.shell.enableInteractiveShell defaults to true), the system
  prompt tolerates interactive commands, and only the 300-second inactivityTimeout ends the wait.
  Contrasts with Claude Code, whose Bash tool gives the child /dev/null as stdin. Use when a Gemini
  CLI session appears hung with "press tab to focus", or when porting non-interactive assumptions
  from Claude Code. Not for headless `gemini -p` runs, which fall back to child_process with stdin
  ignored, and not for sandbox permission errors.
tags: [gemini-cli, claude-code, tool-use]
keywords:
  - Gemini CLI
  - run_shell_command
  - enableInteractiveShell
  - inactivityTimeout
  - node-pty
  - ConPTY
  - press tab to focus
  - 対話コマンド
  - 入力待ち
  - ハング
  - vim
  - git commit
  - GIT_EDITOR
  - GIT_TERMINAL_PROMPT
  - stdin
  - headless
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [gemini-cli@0.58, claude-code@2.1]
sources:
  - https://github.com/google-gemini/gemini-cli/blob/v0.58.0/packages/core/src/services/shellExecutionService.ts
  - https://github.com/google-gemini/gemini-cli/blob/v0.58.0/packages/core/src/config/config.ts
  - https://github.com/google-gemini/gemini-cli/blob/v0.58.0/packages/cli/src/config/settingsSchema.ts
  - https://github.com/google-gemini/gemini-cli/blob/v0.58.0/packages/core/src/prompts/snippets.ts
  - https://github.com/google-gemini/gemini-cli/blob/v0.58.0/packages/cli/src/ui/constants.ts
  - https://github.com/google-gemini/gemini-cli/blob/v0.58.0/docs/tools/shell.md
---

# Gemini CLI の対話モードでは対話コマンドが pty の入力待ちで最長 5 分止まる

## 症状

Gemini CLI の TUI でエージェントが `vim`、`ssh`、`-m` 無しの `git commit`、`npx create-*` のような対話コマンドを
`run_shell_command` で実行すると、コマンドは失敗せずに入力待ちのまま止まる。画面には次の順で案内が出る。

| 無出力の経過 | 表示 |
|---|---|
| 5 秒 | "press tab to focus" のヒント (`SHELL_FOCUS_HINT_DELAY_MS`) |
| 30 秒 | タイトルが action required に変わる (`SHELL_ACTION_REQUIRED_TITLE_DELAY_MS`) |
| 300 秒 | `tools.shell.inactivityTimeout` の既定値に達し、強制終了してモデルに次の文が返る |

```
Command was automatically cancelled because it exceeded the timeout of 5.0 minutes without output.
```

人が Tab でシェルにフォーカスして入力しない限り、対話コマンド 1 つにつき 5 分ずつ消える。

## 原因

Gemini CLI は対話コマンドを「止める」のではなく「人に渡す」設計になっている。

- **本物の pty で実行する。** `tools.shell.enableInteractiveShell` の既定値は true で、`isInteractiveShellEnabled()` は
  `interactive && ptyInfo !== 'child_process' && enableInteractiveShell` を返す。TUI 起動時はこれが true になり、
  node-pty (Windows は ConPTY) の中でコマンドが動く。stdin は生きていて、入力待ちは正常な状態として扱われる
- **システムプロンプトが対話コマンドを許容している。** snippets.ts の文言は「非対話コマンドを優先せよ。ただし ssh や vim のように
  対話しかないコマンドもある。実行するなら Tab でシェルに入力できると伝えよ」で、禁止ではない
- **`GIT_EDITOR` を設定しない。** 子プロセスの環境に `GIT_TERMINAL_PROMPT=0` `GIT_ASKPASS=` `SSH_ASKPASS=` `GH_PROMPT_DISABLED=1`
  `GCM_INTERACTIVE=never` `DISPLAY=` `DBUS_SESSION_BUS_ADDRESS=` `PAGER=cat` `GIT_PAGER=cat` は注入するが、`GIT_EDITOR` と
  `EDITOR` は無い。`-m` 無しの `git commit` はエディタが pty 内で開く

対照として Claude Code の Bash ツールは stdin を `/dev/null` にし `GIT_EDITOR=true` を注入するので、同じコマンドが即 EOF で失敗して
モデルに戻る ([Claude Code の Bash ツールは stdin が /dev/null で GIT_EDITOR=true が入っていた](claude-code-bash-tool-stdin-is-dev-null.md))。
ただし Claude Code 側には `GIT_TERMINAL_PROMPT=0` が無く、`/dev/tty` を直接開く認証プロンプトは止められない。
両者は互いに相手が持つ抑止を欠いている。

## 回避策

- `tools.shell.enableInteractiveShell` を false にする。`child_process.spawn` に落ち、stdio は `['ignore', 'pipe', 'pipe']` で stdin が捨てられる。
  推奨の設定と他の層は [エージェントの shell ツールは対話を人に渡さず即失敗させるべき](fail-interactive-shell-commands-fast.md)
- `tools.shell.inactivityTimeout` を短くする (秒)。pty を残したまま被害だけ縮めたいとき
- `.gemini/.env` に `GIT_EDITOR=true` を書く。dotenv で process.env に入り、子プロセスに継承される経路になる。ただし信頼済みフォルダでないと
  `.env` は読まれず、`advanced.ignoreLocalEnv` の影響も受ける。この経路はソースから読んだだけで動かして確かめていない

headless (`gemini -p`) では `interactive` が false になり、設定に関わらず child_process に落ちるので、この症状は出ない。

## 再現条件

- Gemini CLI v0.58.0 のソースを読んで確認した。実行しての観測ではない。main (0.60 nightly) でも環境変数の一覧と判定式は同じだった
- Windows では bash ではなく PowerShell (`ComSpec` が PowerShell ならそれ、無ければ PATH の pwsh.exe、それも無ければ powershell.exe) で
  `-NoProfile -Command` を付けて実行する。`-NonInteractive` は ComSpec 経路と powershell.exe 経路にだけ付き、PATH の pwsh.exe 経路には付かない
- Claude Code 側の対照は VS Code 拡張 (2.1.261) の Bash ツールで実測した。ターミナルの CLI では確かめていない

## 関連

- [エージェントの shell ツールは対話を人に渡さず即失敗させるべき](fail-interactive-shell-commands-fast.md)
- [Claude Code の Bash ツールは stdin が /dev/null で GIT_EDITOR=true が入っていた](claude-code-bash-tool-stdin-is-dev-null.md)
- [Claude Code の worktree 隔離は Gemini CLI に移植すると強制が消える](../agents/worktree-isolation-not-portable-to-gemini-cli.md)
