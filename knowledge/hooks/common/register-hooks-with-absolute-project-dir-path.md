---
type: pitfall
nature: fact
title: hook は CLAUDE_PROJECT_DIR 基準の絶対パスで登録しないと cwd 次第で全 deny のロックアウトになる
description: >-
  Explains why a Claude Code hook registered with a repository-relative command (`bash
  .claude/hooks/guard.sh`) fails with exit 127 whenever the handler's working directory is not the
  repository root (after a cd, in a subdirectory launch), and why that is worse than
  a missing hook: a fail-closed wrapper (`bash guard.sh || printf '{"…deny…"}'`) turns the 127 into a
  denial on every guard at once, so writes, commands, and plan mode are all blocked and the agent
  cannot repair anything, while advisory hooks just stop silently. Use when writing the `command` field
  of a hook in settings.json, or when every tool call suddenly gets denied with the generic "could not
  decide" id. Not for the separate question of which directory a hook should judge against, which is
  the input JSON's `cwd`.
tags: [claude-code, security]
keywords: [hook, settings.json, command, 相対パス, 絶対パス, CLAUDE_PROJECT_DIR, cwd, exit 127, ロックアウト, fail-closed ラッパ, 全 deny, Handlers run in the current directory, ダブルクォート, shell form]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
---

# hook は CLAUDE_PROJECT_DIR 基準の絶対パスで登録しないと cwd 次第で全 deny のロックアウトになる

## 症状

hook の登録を `"command": "bash .claude/hooks/20-PreToolUse/guard.sh"` のようにリポジトリルート相対で書いていた。
拒否側の hook は「本体が起動できなければ deny を出す」fail-closed のラッパ (`bash <パス> || printf '{…deny…}'`) で包んである。

Claude が `cd` した後、あるいはサブディレクトリで起動したセッションでは、この相対パスが解決できず `bash` が終了 127 で落ちる。
ラッパの `||` はまさにこの失敗を拾って deny を出す設計なので、**拒否側の hook 5 本が同時に deny を返し、書き込み・コマンド実行・プランモード・サブエージェント起動のすべてが止まる**。
AI にできることは無い (ファイルを直そうにも書き込みが deny される)。回復は新しいセッションで緊急停止の環境変数を立てるしかない。

案内側の hook は同じ状況で**静かに動作しなくなる**。deny が出ないので誰も気づかない。

## 原因

公式の 2 つの記述を並べると分かる。

> Handlers run in the current directory with Claude Code's environment.

> Use absolute paths: specify full paths for scripts. In exec form, use `${CLAUDE_PROJECT_DIR}` and the path needs no quoting. In shell form, wrap it in double quotes.

hook はプロジェクトルートではなく**現在のディレクトリ**で走る。cwd が消えていたときだけ「起動ディレクトリ → プロジェクトルート → ホーム → temp」へフォールバックするが、
存在する別のディレクトリにいる限りフォールバックは働かない。相対パスの解決先は cwd 次第になる。

## 回避策

登録を `${CLAUDE_PROJECT_DIR}` 基準の絶対パスにする。shell 形式ではダブルクォートが必須。

```json
{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR}/.claude/hooks/20-PreToolUse/guard.sh\"" }
```

fail-closed のラッパも同じ形で包む。登録の期待値をテストで照合するなら `command` 文字列そのものを対象に含める。

- 本体の先頭で `cd` する案は効かない。本体が起動できないのが問題で、本体の中身では解決しない
- ラッパを `|| exit 0` にして逃げる案は、フェイルクローズドの原則そのものを捨てる。127 と「判定できなかった」を区別できない以上、原因を潰す
- `CLAUDE_PROJECT_DIR` が未設定なら `/.claude/hooks/...` を探して 127 になるが、これは「登録が壊れている」という正しい失敗で、cwd 依存の不定な失敗より扱いやすい

**worktree だけは 127 にならない。** worktree は完全なチェックアウトなので `.claude/hooks/` ごと存在し、相対パスは解決に成功する。
ただし解決先はそのブランチのコピーで、本体の版ではない (実測、claude-code@2.1)。127 で落ちるより静かで、
「ガードは動いているが中身が別物」という形の食い違いになる。
[EnterWorktree で worktree に入ってもプロジェクト設定は起動ディレクトリのものが効き続ける](../../agents/enter-worktree-keeps-launch-directory-settings.md) を参照。

`${CLAUDE_PROJECT_DIR}` はスクリプトの**置き場**を指すためのもので、判定の**基準**にはしない。Claude が worktree に入っても値は起動時のプロジェクトルートに留まり、
作業ディレクトリは入力 JSON の `cwd` が追従する。
[worktree に入るとガード hook の前提が変わる](hook-guards-under-worktree-isolation.md) を参照。

## 再現条件

公式 hooks リファレンス (2026-09 時点) の記述による。ロックアウトの形は fail-closed ラッパを使う構成に固有で、ラッパ無しなら「hook が無いのと同じ」に落ちる。

## 関連

- [worktree に入るとガード hook の前提が変わる](hook-guards-under-worktree-isolation.md)。置き場と作業ツリーを分ける理由
- [EnterWorktree で worktree に入ってもプロジェクト設定は起動ディレクトリのものが効き続ける](../../agents/enter-worktree-keeps-launch-directory-settings.md)。worktree では 127 にならず別のコピーに解決する
- [ガードの設定が読めないときも復旧経路を残す](keep-recovery-path-when-guard-config-breaks.md)。同じ「ガード hook が自分を止めて回復手段を奪う」形のロックアウト
- [hook を注入系とガード系に分け、失敗時の既定を逆にする](injecting-vs-guarding-hooks.md)
