---
type: pitfall
title: Claude Code の worktree 隔離は Gemini CLI に移植すると強制が消える
description: >-
  Warns that a workflow built on Claude Code worktrees does not carry over to Gemini CLI, whose
  worktree support is an experimental launch flag that splits directories but documents no
  enforcement, no mid-session entry, and no cleanup, so the guarantee that an agent cannot touch the
  main checkout silently disappears while the directory layout still looks the same. Use when a
  worktree-based parallel workflow has to run on more than one agent CLI, or when deciding how much
  of it to build yourself. Not for Claude Code-only setups, where the built-in feature is worth
  using as is, and not a general comparison of the two tools.
tags: [claude-code, gemini-cli, workflow]
keywords:
  - worktree
  - Gemini CLI
  - 移植
  - portability
  - experimental.worktrees
  - .gemini/worktrees
  - .claude/worktrees
  - EnterWorktree
  - --worktree
  - -w
  - 隔離の強制
  - BeforeTool
  - 承認プロンプト
  - bypassPermissions
  - .worktreeinclude
  - 後始末
status: stable
verified_at: 2026-09-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/worktrees
  - https://code.claude.com/docs/en/tools-reference
  - https://geminicli.com/docs/cli/git-worktrees/
  - https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/git-worktrees.md
---

# Claude Code の worktree 隔離は Gemini CLI に移植すると強制が消える

## 症状

[並列で走らせるエージェントは git worktree で隔離する](parallel-agents-isolated-by-worktree.md) の運用を
Gemini CLI に持っていくと、ディレクトリの分離だけが残り、**その中に留まる保証が消える**。

見た目は変わらない。worktree は作られ、エージェントはその中で作業を始める。ただし main checkout に戻って
編集することを止めるものが無い。設定を書く場所も警告も無いので、隔離されているつもりのまま
main checkout が書き換わる。

## 原因

同じ「worktree 機能」という名前でも、担っている範囲が違う。

| | Claude Code | Gemini CLI |
|---|---|---|
| 提供状態 | 標準 | 実験的。`experimental.worktrees` を有効にして初めて使える |
| 起動フラグ | `--worktree <name>` | `--worktree` / `-w` |
| 途中から入る | `EnterWorktree` ツール。エージェントが自分で判断できる | 文書化されていない |
| 置き場所 | `.claude/worktrees/` | `.gemini/worktrees/` |
| main checkout への編集を止める | 止める | 記述が無い |
| サブエージェント単位の隔離 | `isolation: worktree` | 無し |
| 後始末 | 変更が無ければ自動削除。定期 sweep | 何も消さない。全部手動 |
| gitignore されたファイルの持ち込み | `.worktreeinclude` | 無し |

Claude Code 側で消えるのは、実際には次の 4 つ。どれもランタイムの内側でしか掛けられないので、
スクリプトで作り直せない。

- **4 つのチェック。** main checkout を狙う `Edit` / `Write` / `NotebookEdit`、main checkout に解決される
  作業ディレクトリ、`git -C` や `GIT_DIR` や `cd` で git を main checkout に向けるコマンド、
  行き先を判定できない形のコマンドを止める。最後の 1 つは無効化できない
- **サブエージェントへの伝播。** 隔離セッションから生えたサブエージェントにも同じチェックが掛かる
- **セッションと worktree の結び付け。** resume が worktree に戻り、transcript も新しい作業ディレクトリ側に記録される
- **採用前の git identity 検査。** メタデータが main checkout に解決されるディレクトリ、ネットワークパス、
  symlink になった worktree パスを拒否する。壊れた worktree で `git reset --hard` が main に効く事故を防ぐ

## 回避策

**worktree を「ディレクトリの分離」としてだけ移し、強制は Claude Code 限定の層として扱う。**
[ConfigChange と FileChanged に頼ったガードは他のエージェント CLI へ移植できない](hook-event-portability-across-agent-clis.md)
と同じ形で、共通部分と上乗せを分けて書いておく。

- **共通に置けるのは作成・環境の作り直し・後始末の手順だけ。** 入る手段と強制は CLI ごとに変わる
- **置き場所は各 CLI の既定に合わせる。** 共通の `.worktrees/` に寄せたくなるが、Claude Code では
  `.claude/worktrees/` の外に `EnterWorktree` すると毎回承認を求められる。permission ルールでも
  「次回から確認しない」でも抑えられず、`bypassPermissions` だけが例外。揃えた見返りより摩擦が大きい
- **Gemini CLI 側で強制が要るなら `BeforeTool` で自作する。** 作業ディレクトリの外を触るツール呼び出しを
  拒否するところまでは組める。ただしコマンド文字列から git の行き先を判定する部分まで再現するのは
  現実的ではないので、同等にはならないと決めて運用する
- **判断のタイミングも移らない。** Claude Code は依頼を読んでからエージェントが `EnterWorktree` で入れる。
  Gemini CLI は起動フラグしか無いので、途中で隔離が要ると分かったら起動をやり直すことになる

自前実装に寄せて両方を揃える案もあるが、揃うのは低い方に揃う。Claude Code だけで使うなら
組み込みの機能をそのまま使い、移すときに落ちる層をこのファイルで確認する方が得になる。

## 再現条件

両方の公式ドキュメントで確認した (2026-09-05)。Gemini CLI 側のページはバージョンを書いていないので
`applies_to` には入れていない。実験的な機能なので、有効化の方法も範囲も変わりうる。

「記述が無い」は「動作しない」ではない。Gemini CLI が main checkout への編集を止めるかどうかは
ドキュメントからは分からないという意味で、止まらないことを確かめたわけではない。**保証として当てにしない**、
という扱いにする。

## 関連

- [並列で走らせるエージェントは git worktree で隔離する](parallel-agents-isolated-by-worktree.md) — 移植元の運用
- [ConfigChange と FileChanged に頼ったガードは他のエージェント CLI へ移植できない](hook-event-portability-across-agent-clis.md) — 同じ「共通部分で組む」判断の別例
- [worktree に入るとガード hook の前提が変わる](hook-guards-under-worktree-isolation.md) — Claude Code 内でもガードの前提はずれる
