---
type: note
nature: finding
title: hook プロセスには CLAUDE_CODE_SESSION_ID と CLAUDE_PROJECT_DIR などが環境変数で入っていた
description: >-
  Records which CLAUDE_* environment variables a Claude Code hook process actually receives, measured
  by dumping the environment from a PreToolUse command hook in the VS Code extension (2.1.261):
  CLAUDE_CODE_SESSION_ID (equal to the stdin session_id), CLAUDE_CODE_CHILD_SESSION, CLAUDE_PID,
  CLAUDE_EFFORT, CLAUDE_PROJECT_DIR, CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, and the messaging socket
  and token, and compares it with what the Bash tool's subprocess gets. Also notes the documented
  CLAUDE_CODE_SUBPROCESS_ENV_SCRUB list for stripping credentials from hooks and Bash. Use when a hook
  needs the session or project without parsing stdin, or when deciding which secrets subprocesses may
  see. Not for variables the agent's own shell profile sets, and not measured for the CLI, Gemini
  CLI, or the scrub variable itself.
tags: [claude-code, security, observability]
keywords:
  - CLAUDE_CODE_SESSION_ID
  - CLAUDE_CODE_CHILD_SESSION
  - CLAUDE_PID
  - CLAUDE_EFFORT
  - CLAUDE_PROJECT_DIR
  - CLAUDECODE
  - CLAUDE_CODE_ENTRYPOINT
  - CLAUDE_CODE_MESSAGING_TOKEN
  - CLAUDE_CODE_SUBPROCESS_ENV_SCRUB
  - CLAUDE_ENV_FILE
  - 環境変数
  - hook プロセス
  - 子プロセス
  - session_id
  - 資格情報
  - 漏洩
status: stable
sources:
  - https://code.claude.com/docs/en/env-vars
  - https://code.claude.com/docs/en/hooks
---

# hook プロセスには CLAUDE_CODE_SESSION_ID と CLAUDE_PROJECT_DIR などが環境変数で入っていた

## 実測

VS Code 拡張 (Claude Code 2.1.261、Windows 10、Git Bash) で、PreToolUse の command hook から `env | grep ^CLAUDE` をファイルに書き出した。同じセッションの Bash ツールでも同じことをした。

| 変数 | hook プロセス | Bash ツールの子プロセス | 意味 |
|---|---|---|---|
| `CLAUDE_CODE_SESSION_ID` | あり。stdin の `session_id` と同じ値 | あり | セッション ID |
| `CLAUDE_CODE_CHILD_SESSION` | `1` | `1` | Claude Code が直接起こした子であること。孫プロセスには入らない (公式) |
| `CLAUDE_PID` | あり | あり | Claude Code 本体の PID |
| `CLAUDE_EFFORT` | `high` | `high` | effort level |
| `CLAUDE_PROJECT_DIR` | あり (`/` 区切り) | **無し** | hook と stdio MCP にだけ入る。worktree に入っても起動時のルートに留まる |
| `CLAUDECODE` | `1` | `1` | このリポジトリの `.githooks/pre-commit` が「Claude Code からの commit か」の判定に使っている |
| `CLAUDE_CODE_ENTRYPOINT` | `claude-vscode` | `claude-vscode` | 起動元。拡張と CLI を hook で見分けられる |
| `CLAUDE_CODE_MESSAGING_SOCKET` / `_TOKEN` | あり | あり | セッション間メッセージング用のパイプとトークン |
| `CLAUDE_AGENT_SDK_VERSION` | あり | あり | |

公式 env-vars ページの記述 (session ID は Bash / PowerShell ツール、tmux、hook、statusline、stdio MCP に入る) と一致した。

## 使いどころ

- **hook が `session_id` を stdin 解析前に使える。** セッションごとのファイルのパスを環境変数から組み、副入力を最初の `jq` に相乗りさせられる ([fork の回数で予算を決める](../scripts/count-forks-not-seconds-for-hot-path-hooks.md))
- **`CLAUDE_PROJECT_DIR` は hook 専用。** Bash ツールから呼ぶスクリプトには入らないので、hook とスクリプトで同じライブラリを共有するなら、無いときの後退 (`git rev-parse` など) を持つ
- **`CLAUDE_CODE_ENTRYPOINT` で拡張と CLI を分岐できる。** systemMessage が拡張で表示されないような差を hook 側で吸収する余地がある
- **`CLAUDE_CODE_CHILD_SESSION` で孫を見分ける。** hook から起こしたスクリプトが「hook の中で走っているか」を知る手段にはならない (孫には入らない)

## 資格情報を子プロセスから抜く

hook もBash ツールも親の環境をそのまま継ぐ (公式: `OTEL_*` だけ除かれる)。上の表のとおりメッセージング用トークンまで入るし、シェルに `GH_TOKEN` や `ANTHROPIC_API_KEY` を置いていればそれも hook とサブプロセスに渡る。

公式は `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` に**変数名のカンマ区切り**を与えると、Bash / PowerShell ツール、tmux、hook、stdio MCP の環境からそれらを消すと書いている。
[エージェントの gh / glab 認証は範囲限定トークン 1 本に寄せる](../../workflow/scoped-token-for-agent-git-cli-auth.md) と組むなら、残すのはその 1 本だけにして、IDE や別ツール用の資格情報はここで落とす。
hook から LLM の CLI を呼ぶ構成 ([Stop の 2 回目に Haiku レビュー](../11-Stop/haiku-prompt-hook-reviews-final-report-on-second-stop.md) など) で API キーを hook に見せたくない場合も同じ。

逆方向 (hook からエージェントの Bash へ値を渡す) は `CLAUDE_ENV_FILE`。SessionStart / Setup / CwdChanged / FileChanged の hook だけがこのパスを受け取り、`export` 行を追記するとその後の Bash コマンドに効く。

## 確かめていないこと

- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` を実際に設定して、hook と Bash から変数が消えるか。settings の `env` ブロックで指定できるかも未確認
- ターミナルの CLI で同じ変数が入るか (拡張でしか測っていない)
- `CLAUDE_ENV_FILE` を Windows の Git Bash で使ったときのパス形式
- prompt 型と agent 型の hook (プロセスを起こさない) に相当する情報がどう渡るか

## 昇格の目安

- [ ] 粒度が `reference` に収まっている (hook プロセスの環境変数一覧、として切れる)
- [x] sources に一次情報がある
- [ ] scrub まで試して applies_to と verified_at を書ける (現状は注入の実測だけ)
