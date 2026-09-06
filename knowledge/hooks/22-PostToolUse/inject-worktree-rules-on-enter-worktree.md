---
type: pattern
nature: heuristic
title: worktree 固有の規約は EnterWorktree の PostToolUse で注入した方がよい
description: >-
  A way to make tree-specific conventions follow a Claude Code session into a git worktree even
  though `CLAUDE.md` stays bound to the launch directory: register a PostToolUse hook matching
  `EnterWorktree`, resolve the tree root from the hook input's `cwd`, and emit that tree's rules file
  as `hookSpecificOutput.additionalContext`. Use when the same session enters worktrees with
  EnterWorktree and per-branch conventions differ, and when moving rules out of `CLAUDE.md` is
  acceptable. Not for guards that must be enforced, which belong in a deny-capable hook, and not for
  sessions launched directly inside the worktree, where `CLAUDE.md` already resolves there.
tags: [claude-code, context-management, workflow]
keywords:
  - PostToolUse
  - EnterWorktree
  - additionalContext
  - hookSpecificOutput
  - worktree
  - CLAUDE.md
  - cwd
  - rev-parse
  - show-toplevel
  - tree-rules
  - UserPromptSubmit
  - 規約の注入
  - 作業ツリー
status: stable
verified_at: 2026-09-07
stale_after: 2027-03-07
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/worktrees
intervention: hook
---

# worktree 固有の規約は EnterWorktree の PostToolUse で注入した方がよい

## 課題

`EnterWorktree` で worktree に移っても `CLAUDE.md` は起動ディレクトリのものが効き続ける
([EnterWorktree で worktree に入ってもプロジェクト設定は起動ディレクトリのものが効き続ける](../../agents/enter-worktree-keeps-launch-directory-settings.md))。
ブランチごとに規約が違っても、セッションが読む規約は本体のまま動かない。
worktree でセッションを起動し直せば解決するが、拡張で同じセッションを続けたい場合はそれを選べない。

## 解決

規約を `CLAUDE.md` から外して `.claude/tree-rules.md` のようなツリー内のファイルに置き、
`EnterWorktree` に matcher を張った PostToolUse hook で注入する。この hook は worktree に移った直後に発火し、
入力 JSON の `cwd` も worktree を指す。

```sh
cwd=$(cat | jq -r '.cwd' | tr '\' '/')
root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || root="$cwd"
f="$root/.claude/tree-rules.md"
[ -f "$f" ] || exit 0
jq -n --arg c "現在の作業ツリー $root の規約:

$(cat "$f")" \
  '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$c}}'
```

同じスクリプトを UserPromptSubmit にも掛けておくと、圧縮で落ちてもターンごとに入り直す。

## 適用条件

- 注入する文書は**規約・事実の形で書く**。「必ず〜と書け」という命令形にすると、モデルが prompt injection とみなして
  明示的に拒否する ([hook の additionalContext に命令形を書いたらモデルが指示として拒否した](additional-context-refused-as-injection.md))
- 効くのは「守らせる」ではなく「知らせる」用途まで。強制したいものは deny を返せる PreToolUse で打つ
- worktree でセッションを直接起動する運用なら不要。`CLAUDE.md` がそのツリーのものに解決する
- hook の登録は相対パスにする。絶対パスで `${CLAUDE_PROJECT_DIR}` を使うと本体側のスクリプトが走る

## トレードオフ

- 規約が `CLAUDE.md` から離れるので、置き場が 2 つになる。全ツリー共通のものだけ `CLAUDE.md` に残し、
  ツリーで変わるものだけ `tree-rules.md` に出す、という分け方を決めておかないと二重管理になる
- `additionalContext` は毎回トークンを食う。UserPromptSubmit に掛けるならツリーが変わったときだけ出すなどの間引きが要る
- `CLAUDE.md` のような恒久的な位置づけは持たない。会話の途中に入る文脈なので、圧縮で落ちうるし、
  モデルが本体側の `CLAUDE.md` と食い違うと判断すれば矛盾を指摘してくる (実測でそうなった)

## 関連

- [EnterWorktree で worktree に入ってもプロジェクト設定は起動ディレクトリのものが効き続ける](../../agents/enter-worktree-keeps-launch-directory-settings.md)。この課題の出どころ
- [hook の additionalContext に命令形を書いたらモデルが指示として拒否した](additional-context-refused-as-injection.md)。書き方の制約
- [状態を持たない LLM への環境情報は変わる頻度で hook イベントを分けて注入した方がよさそう](../common/split-state-injection-by-staleness.md)。注入する頻度の考え方
