---
type: pitfall
nature: finding
title: worktree に入ったセッションでは複合 git コマンドと git を引数に含む glab の実行が拒否された
description: >-
  Records what the Claude Code Bash tool refused after the session entered a git worktree with
  `EnterWorktree`: a one-liner that chains git with other commands via `;` or `&&`, and a non-git
  launcher whose operands contain the word git (`glab auth git-credential`), both with the message that
  a worktree-isolated session's git operations must target its own worktree. Also notes that after a
  `cd` elsewhere the shell cwd is reset to the worktree. Use when an agent's git commands start failing
  right after entering a worktree, or when writing instructions for agents that work inside one. Not
  for the permission classifier or PreToolUse hooks, which produce different messages, and not measured
  for `claude --worktree` or subagent `isolation: worktree`.
tags: [claude-code, workflow, multi-agent]
keywords:
  - worktree
  - EnterWorktree
  - too complex to verify that it stays inside the worktree
  - worktree-isolated session's git operations must target its own worktree
  - Shell cwd was reset to
  - glab auth git-credential
  - 複合コマンド
  - "&&"
  - セミコロン
  - git rev-parse
  - Bash ツール
  - 拒否
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/worktrees
  - https://code.claude.com/docs/en/tools-reference
---

# worktree に入ったセッションでは複合 git コマンドと git を引数に含む glab の実行が拒否された

## 症状

Claude Code (VS Code 拡張 2.1.261) で `EnterWorktree` に既存 worktree の `path` を渡して入った直後、Bash ツールで次が拒否された。

- `pwd; git branch --show-current; git rev-parse --show-toplevel; git rev-parse --git-dir; env | grep ...` のように git を他のコマンドと `;` でつないだ 1 行。
  文言は「This session is isolated in the worktree <path>, but this command names git in a form too complex to verify that it stays inside the worktree.
  Refusing to run it — a worktree-isolated session's git operations must target its own worktree. Split it into plain, separate commands and run them from <path>」
- `printf '...' | timeout 15 glab auth git-credential get` のように、**git 以外のコマンドの引数に `git` という語を含む**もの。
  文言は「this command runs glab with a git command among its operands: what runs it, and from which directory or root, cannot be read here ...
  so what it runs cannot be shown not to be git. Refusing to run it」

どちらも実行前に止まるので、コマンドは 1 度も走っていない。拒否は permission の分類器や hook のものとは別で、Bash ツール自身が返す。

もう 1 つ、worktree の中で `cd <main checkout> && node ...` を実行したら、成功はしたが出力の末尾に
「Shell cwd was reset to <worktree のパス>」と付いた。worktree の外へ `cd` しても次のコマンドの cwd は worktree に戻る。

## 原因

worktree に入ったセッションの Bash には「git 操作が自分の worktree の中に留まること」を検査するガードがある。
検査できるのは単文の git コマンドだけで、`;` `&&` でつないだ行や、別コマンド経由で git が走りうる形は
「検査できない」として拒否側に倒れる。`glab auth git-credential` は git を呼ばないが、引数の `git` という語だけで検査不能と判定された。

cwd のリセットは、`cd` による worktree の外への迂回を防ぐためのものと読める。
[worktree に入ったらガード hook の前提が変わった](../hooks/common/hook-guards-under-worktree-isolation.md) で懸念していた「`cd` による迂回」は、
少なくとも Bash ツール本体の cwd については塞がれている。

## 回避策

- git コマンドは 1 行 1 コマンドにする。`pwd` と `git branch --show-current` を別々の Bash 呼び出しにするだけで通る
- 複数の値を一度に見たいなら、git を含まない側 (`pwd`、`env | grep`) だけをつなぐ
- credential helper の単体テスト (`glab auth git-credential get`) は worktree に入る前か、抜けた後に行う
- エージェントに worktree 内の作業を指示するときは、「git は単文で」と手順に書いておく。拒否文にも同じ指示が入るので、書かなくても 1 回失敗すれば直る

## 再現条件

- Claude Code 2.1 (VS Code 拡張 2.1.261)。`EnterWorktree` の `path` で `git worktree add` で作った worktree に入った直後
- Bash ツール。PowerShell ツールは試していない
- `EnterWorktree` の `name` で新規作成した場合、`claude --worktree`、サブエージェントの `isolation: worktree` では未確認 (同じガードだと思われるが見ていない)

## 関連

- [GitLab のマージリクエストのブランチで worktree に入るには git で自分で追加して EnterWorktree に path を渡すべき](worktree-on-gitlab-merge-request-branch.md)
- [並列で走らせるエージェントは git worktree で隔離すべき](parallel-agents-isolated-by-worktree.md)
