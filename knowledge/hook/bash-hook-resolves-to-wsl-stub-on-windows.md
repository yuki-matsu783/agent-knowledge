---
type: pitfall
nature: fact
title: Windows では hook の "bash" が WSL のスタブに解決されて無言で動かない
description: >-
  Explains why a Claude Code hook configured as `"command": "bash ..."` silently does nothing on Windows: the
  system PATH lists C:\Windows\System32 (which holds the WSL launcher bash.exe) before Git for Windows, and the
  Git installer adds only Git\cmd, not Git\bin where bash.exe lives, so the hook runs inside WSL where
  ${CLAUDE_PROJECT_DIR} is a Windows path and the error is swallowed. Use when a hook that works on Linux or
  in a colleague's terminal never fires on a Windows machine, or when deciding between a hard-coded bash path
  and PATH resolution in settings.json. Lists the official levers to try first (CLAUDE_CODE_GIT_BASH_PATH, the
  hook `shell` field, not spelling `bash` in the command) before editing the machine PATH. Not for WSL-native
  Claude Code sessions, and not for PowerShell hooks.
tags: [claude-code, workflow]
keywords: [bash.exe, WSL, System32, PATH, Git for Windows, Git\bin, Git\cmd, where.exe bash, システム環境変数, Machine スコープ, setx, 1024 文字, hook が動かない, CLAUDE_PROJECT_DIR, settings.json, command, CLAUDE_CODE_GIT_BASH_PATH, shell フィールド]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/setup
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# Windows では hook の "bash" が WSL のスタブに解決されて無言で動かない

## 症状

`.claude/settings.json` の hook を `"command": "bash .claude/hooks/foo.sh"` と書くと、Windows でエラーも出ずに hook が何もしない。
SessionStart の注入が来ない、PreToolUse のガードが効かない。`where.exe bash` を打つと先頭に `C:\Windows\System32\bash.exe` が出る。

## 原因

- Windows のシステム環境変数 `PATH` は `C:\Windows\System32` を Git for Windows より先に列挙する。System32 には WSL 起動用のスタブ `bash.exe` がある
- Git for Windows のインストーラは既定で `Git\cmd` (`git.exe` 用) だけを PATH に足し、`bash.exe` のある `Git\bin` は足さない
- 結果、素の `bash` は**エラーにならず WSL 側のスタブへ解決される**。WSL 内では `${CLAUDE_PROJECT_DIR}` が Windows 形式のパスのままで解決できず、
  hook は例外を握りつぶす設計なのでメッセージも出ない

「エラーになったらパスを通す手順を案内する」という前提そのものが成り立たない。

公式の hooks リファレンスは、shell form の `command` を Windows では Git Bash で実行する (Git Bash が無ければ PowerShell) と書いている。
つまり `bash` と書かなくてもスクリプトは Git Bash 配下で走る前提で、コマンド文字列に bare `bash` を書くことで PATH 解決が 1 段余計に入り、そこで System32 に取られる。

## 回避策

先に公式の手当てを試す。どれもリポジトリの設定で済み、マシンの環境変数を触らない。

- **コマンド文字列に `bash` を書かない。** `"command": "sh \"${CLAUDE_PROJECT_DIR}/.claude/hooks/foo.sh\""` のように絶対パスで指定する (公式は絶対パスを推奨)。
  shell form は Git Bash で実行されるので、`bash` を名指しする必要が無い
- **Claude Code に Git Bash の場所を教える。** settings.json の `env` に `CLAUDE_CODE_GIT_BASH_PATH` を `C:\\Program Files\\Git\\bin\\bash.exe` で設定する
  (setup ページの手順。Bash ツール向けの設定だが、hook の shell form も同じ Git Bash を使う)
- 必要なら hook ごとに `"shell": "powershell"` を指定して PowerShell スクリプトにする。POSIX sh の共通化を捨てることになるので最後の手

それでも直らない、あるいは他のスクリプトからも `bash` を呼ぶ都合で PATH 側を直したいなら、フルパス直書き (`C:\Program Files\Git\bin\bash.exe`) は
他の開発機へ移植できないので採らず、開発機ごとに 1 度だけ次を行う。

1. **システム環境変数** (Machine スコープ) の `Path` に `C:\Program Files\Git\bin` を、`C:\Windows\System32` より前に来る位置で追加する。
   **ユーザー環境変数では効かない**。Windows の有効 PATH はシステム側が先に連結されるので、ユーザー側に何を積んでも System32 より後ろになる
2. 設定は PowerShell の `[Environment]::SetEnvironmentVariable(..., 'Machine')` で行う。`setx` はシステム PATH が 1024 文字を超えると
   値を切り詰めて破壊する既知の危険がある
3. `where.exe bash` で Git Bash が先頭に来ること、実セッションで SessionStart hook が注入することを確かめる

この対処はリポジトリに残らないマシンごとのセットアップなので、README のセットアップ手順に書いておく。

## 再現条件

Windows 10、Git for Windows 既定インストール、WSL 有効。hook が失敗を握りつぶす設計 (fail-open) のとき症状が隠れる。
上の公式の手当て (絶対パス、`CLAUDE_CODE_GIT_BASH_PATH`) でこの症状が消えるかは、元プロジェクトでは試していない。PATH の修正だけで解消したことが確認されている。

## 関連

- [hook は CLAUDE_PROJECT_DIR 基準の絶対パスで登録しないと cwd 次第で全 deny のロックアウトになる](register-hooks-with-absolute-project-dir-path.md)。同じ `bash .claude/hooks/...` の書き方が cwd 側でも壊れる
- [hook を注入系とガード系に分け、失敗時の既定を逆にする](injecting-vs-guarding-hooks.md)。ガード側が fail-open だと、この症状で守りが無言で消える
- [タイムアウトした hook はガードにならず素通りする](hook-timeout-fails-open.md)
