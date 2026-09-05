---
type: pattern
nature: best-practice
title: エージェントの shell ツールは対話を人に渡さず即失敗させるべき
description: >-
  Recommends configuring an agent's shell tool so interactive commands fail immediately and return
  to the model instead of waiting for a human: in Gemini CLI set tools.shell.enableInteractiveShell
  to false (child_process with stdin ignored) and shorten tools.shell.inactivityTimeout; in Claude
  Code add GIT_TERMINAL_PROMPT=0 and similar non-interactive variables via settings.json env, then
  layer permissions.deny, a PreToolUse/BeforeTool hook, and a rules line. Use when an agent session
  stalls on vim, ssh, credential prompts, or `git commit` without -m, or when running agents
  unattended. Not for sessions where a human deliberately drives interactive TUIs through the agent.
tags: [claude-code, gemini-cli, tool-use, workflow]
keywords:
  - 対話コマンド
  - 非対話
  - enableInteractiveShell
  - inactivityTimeout
  - GIT_TERMINAL_PROMPT
  - GIT_EDITOR
  - PAGER
  - DEBIAN_FRONTEND
  - npm_config_yes
  - PIP_NO_INPUT
  - GH_PROMPT_DISABLED
  - BASH_DEFAULT_TIMEOUT_MS
  - permissions.deny
  - tools.exclude
  - PreToolUse
  - BeforeTool
  - run_shell_command
  - Bash ツール
  - 自動運転
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1, gemini-cli@0.58]
sources:
  - https://github.com/google-gemini/gemini-cli/blob/v0.58.0/docs/tools/shell.md
  - https://github.com/google-gemini/gemini-cli/blob/v0.58.0/docs/hooks/reference.md
  - https://github.com/google-gemini/gemini-cli/blob/v0.58.0/packages/core/src/services/shellExecutionService.ts
  - https://code.claude.com/docs/en/settings
  - https://code.claude.com/docs/en/env-vars
  - https://code.claude.com/docs/en/hooks
intervention: tool
---

# エージェントの shell ツールは対話を人に渡さず即失敗させるべき

## 課題

エージェントが shell ツールで `vim`、`ssh`、`-m` 無しの `git commit`、`npx create-*`、git の資格情報プロンプトなどを実行すると、
コマンドは入力を待ち続ける。人が画面を見ていればその場で打てるが、自動運転や worktree で複数のエージェントを走らせているときは
誰も気づかず、タイムアウトまで止まる。Gemini CLI は既定で 5 分、Claude Code は 2 分。

「対話を人に渡す」か「対話を最初から不可能にする」かは製品ごとに既定が違う。Gemini CLI は前者
([Gemini CLI の対話モードでは対話コマンドが pty の入力待ちで最長 5 分止まる](gemini-cli-shell-hands-interactive-commands-to-the-user.md))、
Claude Code は後者 ([Claude Code の Bash ツールは stdin が /dev/null で GIT_EDITOR=true が入っていた](claude-code-bash-tool-stdin-is-dev-null.md))。
どちらも単独では穴が残る。

## 解決

**対話コマンドは即失敗させ、その失敗をモデルに返して書き直させる。** 人を待たせる経路を残さない。
層は上から順に安く、下ほど確実。上の層だけで済むならそこで止める。

### Gemini CLI

1. **`tools.shell.enableInteractiveShell: false` にする (推奨)。** pty をやめて `child_process.spawn` に落ち、stdin が `'ignore'` になる。
   stdin を読む対話は即 EOF で失敗し、Claude Code と同じ振る舞いになる。色出力と Tab でのシェル入力を失う
   ```json
   { "tools": { "shell": { "enableInteractiveShell": false, "inactivityTimeout": 60 } } }
   ```
2. **`tools.shell.inactivityTimeout`** を秒で短くする。既定 300。pty を残す場合でも被害を縮められる
3. **`tools.exclude`** に `run_shell_command(vim)` `run_shell_command(nano)` `run_shell_command(less)` `run_shell_command(git rebase -i)` を並べる。
   前方一致で、`&&` `||` `;` で繋いだ各部分を個別に検査する
4. **BeforeTool hook** (matcher `run_shell_command`)。stdin の JSON から `tool_input.command` を読み、`-i` `--interactive` `-it` `tail -f` `watch` を
   exit 2 か `{"decision":"deny","reason":"..."}` で止める。`reason` はモデルに返る
5. **環境変数の追加**。settings.json に全体用の `env` キーは無い (`env` があるのは MCP サーバー定義の中だけ)。`.gemini/.env` に
   `GIT_EDITOR=true` を書くと dotenv 経由で子プロセスに届くはずだが、この経路は動かして確かめていない。
   `GIT_TERMINAL_PROMPT=0` `GH_PROMPT_DISABLED=1` `PAGER=cat` などはハーネスが既に注入している
6. **GEMINI.md** に「`-m` `--yes` `--no-pager` を付ける、サーバーは `is_background: true`」と書く

### Claude Code

stdin は既に `/dev/null` で `GIT_EDITOR=true` も入っているので、足すのは `/dev/tty` を直接開くプロンプトの抑止と、終わらないコマンドの拒否。

1. **settings.json の `env`**。Bash ツールと hook の両方に届く
   ```json
   "env": {
     "GIT_TERMINAL_PROMPT": "0",
     "CI": "1",
     "DEBIAN_FRONTEND": "noninteractive",
     "PAGER": "cat",
     "npm_config_yes": "true",
     "PIP_NO_INPUT": "1",
     "GH_PROMPT_DISABLED": "1",
     "BASH_DEFAULT_TIMEOUT_MS": "60000"
   }
   ```
   `GIT_TERMINAL_PROMPT=0` が一番効く。git の認証プロンプトは `/dev/tty` を読むので stdin が `/dev/null` でも止まらないが、これで即エラーになる
2. **`permissions.deny`** で `Bash(vim:*)` `Bash(nano:*)` `Bash(less:*)` `Bash(top:*)` `Bash(git rebase -i:*)`。前方一致なので `git -c x rebase -i` はすり抜ける
3. **PreToolUse hook** (matcher `Bash`) で `tool_input.command` を見て exit 2。stderr の文面がモデルに返る。判定の書き方は
   [hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒すべき](../hooks/20-PreToolUse/command-position-match-fails-closed.md)
4. **CLAUDE.md** に「`--yes` `-y` `--no-pager` `--batch` を付ける、サーバーは `run_in_background`」と書く

## 適用条件

- 効く: 自動運転、headless、worktree で並列に走らせるセッション、人が画面を離れる運用
- 効かない: 人がエージェント越しに vim や htop を操作したいセッション。Gemini CLI の pty はそのための機能なので、そこでは
  `enableInteractiveShell` を true のまま `inactivityTimeout` だけ縮める
- Gemini CLI の headless (`gemini -p`) は設定に関わらず child_process に落ちるので、1 は不要

## トレードオフ

- 得る: 対話コマンドがタイムアウトではなく即エラーで返り、モデルが `--yes` や `-m` を付けて書き直せる。5 分や 2 分の空転が消える
- 失う: Gemini CLI では色出力と Tab でのシェル入力。Claude Code では `CI=1` によってテストランナーやビルドツールの挙動が変わることがある (watch モードの無効化、色の抑止、一部ツールの厳格化)。`CI=1` は影響範囲を見て外してよい
- どの層も「終わらないコマンド」(`tail -f`、dev サーバー) は止められない。これは拒否 (2、3) か background 実行の指示 (4、6) で扱う

## 関連

- [Gemini CLI の対話モードでは対話コマンドが pty の入力待ちで最長 5 分止まる](gemini-cli-shell-hands-interactive-commands-to-the-user.md)
- [Claude Code の Bash ツールは stdin が /dev/null で GIT_EDITOR=true が入っていた](claude-code-bash-tool-stdin-is-dev-null.md)
- [hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒すべき](../hooks/20-PreToolUse/command-position-match-fails-closed.md)
- [ガード・誘導・自動化の語彙](../hooks/common/guard-steer-automate-mechanisms.md)
