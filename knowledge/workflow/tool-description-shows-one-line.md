---
type: pitfall
title: Bash ツールの description はコンソールに 1 行しか表示されない
description: >-
  Explains that when Claude Code asks the user to approve a Bash or PowerShell call, the `description`
  argument is shown as a single line and anything after the first newline is invisible, so a multi-line
  description reads as thorough to the agent while the reviewer sees only the first sentence; the fix is to
  keep description to one sentence about the whole command and put per-block intent as comments inside
  multi-line commands, never on a one-liner (a `#` swallows the rest) and never as the first line of a
  multi-line command. Use when writing rules for how an agent should describe commands, or when approvals
  feel rubber-stamped. Not for tool definitions in the Messages API, and not a measured claim about
  permissions.allow prefix matching, which is separately unverified.
tags: [claude-code, prompting]
keywords: [description, 1 行, 承認プロンプト, コマンド文字列, コメント, 複数行コマンド, 1 行目, 承認, レビューの空白, Bash ツール, PowerShell ツール, ai-command-style, 出力トークン]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# Bash ツールの description はコンソールに 1 行しか表示されない

## 症状

ユーザーがエージェントのコマンドを承認するときの判断材料は、コマンド文字列と `description` の 2 つだけ。ところが description は
コンソールに 1 行しか表示されず、複数行を渡しても 2 行目以降は出ない (実機確認)。エージェントは「書いた」つもりでも、レビュアーには届かない。
「書いたのに読まれない」状態はレビューの空白を隠すので、単に無効なだけの案より悪い。

## 原因

承認 UI の表示仕様。エージェントがツールへ渡す**コマンド文字列そのもの**の書き方についての規約が無く、
`.sh` ファイルのスタイル規約とは対象が違うことも見落とされやすい。

## 回避策

- `description` は「全体として何をするか」の 1 文に固定する
- **複数行コマンド**では、各論理ブロックの意図をコマンド内の日本語コメントで書く。承認前の安全性を出力トークン増より優先する (試行的運用として明記し、
  運用感が悪ければ見直す前提にする)
- **1 行コマンドにはコメントを付けない。** description で説明が尽きるうえ、`#` は行末までをコメントにするので、後続を飲んで実行されなくなるリスクだけが残る
- **複数行コマンドの 1 行目にコメントを置かない。** 公式は改行を部分コマンドの区切りとして扱い、allow は全部分コマンドの一致を要求すると書いているが、
  コメントだけの行が部分コマンドとして数えられるか無視されるかは書いていない。deny 側はこの環境ではすり抜けなかったが、allow 側は未確認
  ([permissions-deny-any-allow-all-asymmetry.md](permissions-deny-any-allow-all-asymmetry.md))。1 行目を避けるコストはほぼ無く、外れたときの損失は大きい
- コマンドを短く分割して 1 回ずつ承認させる案は、承認回数が増えて 1 回あたりの確認が形骸化するので採らない

## 再現条件

Claude Code、2026-08 時点。description の表示行数はターミナル UI の実装に依存するので、版が変われば変わりうる。

## 関連

- [permissions の deny は ANY、allow は ALL で照合される](permissions-deny-any-allow-all-asymmetry.md)
- [生のコマンド実行を deny してラッパスクリプトへ誘導する](command-wrappers-instead-of-raw-bash.md)
