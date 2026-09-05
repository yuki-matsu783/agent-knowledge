---
type: pattern
nature: heuristic
title: 操作をブロックするか注意喚起で済ませるかは特定可能性と代替経路で決めた方がよさそう
description: >-
  A decision rule for Claude Code hooks: enforce with a blocking PreToolUse hook (exit 2) only when the
  forbidden operation can be identified uniquely from the tool call string and a sanctioned alternative path
  is always available (direct `git commit` vs a wrapper script); when either condition fails, as with "do not
  start implementation right after filing an issue" whose actions are ordinary branch and push commands and
  whose legitimate exception is a human instruction the hook cannot observe, inject a reminder from a
  PostToolUse hook instead and keep documentation as the primary safeguard. Use when tempted to turn a
  process rule into a hard block, or when a block keeps being bypassed by deleting state files. Not for
  choosing hook events or matchers, and not for isolation that must hold against a hostile agent.
tags: [claude-code, security, workflow]
keywords: [PreToolUse, PostToolUse, exit 2, ブロック, 注意喚起, additionalContext, 多重防御, 代替経路, 正規経路, 一意に特定, 状態ファイル, 形骸化, 機構的強制, ドキュメントのみ, issue 起票後]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: hook
---

# 操作をブロックするか注意喚起で済ませるかは特定可能性と代替経路で決める

## 課題

ドキュメントだけのルール (「コミットは commit スキル経由」「issue を起票した直後に同じセッションで着手しない」) は
エージェントの遵守に依存し、実際に破られる。技術的に強制したいが、何でも PreToolUse でブロックすればよいわけではない。
実例では、起票直後の着手を止めたくて検討したブロックが、成立しないと分かって注意喚起へ切り替えた。

## 解決

ブロック (PreToolUse で exit 2) してよいのは次の 2 条件が**両方**揃うときだけ。

| 条件 | 揃う例: `git commit` の直接実行 | 揃わない例: issue 起票直後の着手 |
|---|---|---|
| 禁止したい操作を呼び出し文字列で一意に特定できる | `git commit` という語がコマンド位置にある | 実体は `git checkout -b`・push・PR 作成に分かれ、いずれも日常の汎用コマンド。文字列マッチでは取りこぼしと誤検知が同時に増える |
| 常に使える正規の代替経路がある | ラッパースクリプト経由のコミット | 「人間が明示的に着手を指示した」という正当ケースを hook が観測できない (指示は通常のプロンプトで来て hook イベントにならない) |

代替経路が無い強制は、解除手段が「hook を黙らせる」「状態ファイルを消す」しか無くなり、規範そのものを形骸化させる。
セッション単位の状態ファイルで「起票した」ことを記録して以降を禁止する案も、解除が「AI が自分で状態ファイルを消す」形になるので同じ。

条件が揃わないときは、**PostToolUse で注意喚起を注入する**多重防御に留める。

- 起票を検知したら (CLI 経路はコマンド文字列、MCP 経路は `mcp__github__issue_write` の `method="create"`)、「同じセッションで着手しない」
  「新しいセッションでの実行を勧めるに留める」「AI から着手を持ちかけない」を `hookSpecificOutput.additionalContext` で注入する。
  起票の**後**に発火するので起票そのものは妨げない
- **hook は多重防御であって判断の根拠ではない**と明記する。注入が無かったことを着手してよい根拠にしてはならない
- ドキュメント (skill・共通ルール) を一次的な担保のまま残す。記載を増やすだけでは「流れで進んでしまう瞬間」に効きにくいが、
  その瞬間に一度だけ注入するのは副作用が無く直接効く

## 適用条件

- 効く: エージェントの既定動作を確実な方向へ倒したいプロセスルール
- 効かない: 敵対的な安全境界。ブロック側でも意図的な回避は前提として対策しない

## トレードオフ

- 得る: ブロックが成立する場面では確実に止まり、成立しない場面で無理なブロックを作って運用を壊さない
- 失う: 注意喚起は無視できる。効くのは「うっかり」に対してだけ

## 関連

- [権限は permissions.deny ではなく PreToolUse hook で止める](deny-by-hook-not-permissions.md)。ブロック側の作り方
- [生のコマンド実行を deny してラッパスクリプトへ誘導する](command-wrappers-instead-of-raw-bash.md)。「正規の代替経路」の作り方
- [hook を注入系とガード系に分け、失敗時の既定を逆にする](injecting-vs-guarding-hooks.md)。注意喚起は注入系なので fail-open でよい
- [ルールの文言強化ではなく記録とゲートで抜けを塞ぐ](../rule/close-gaps-with-mechanism-not-wording.md)。ブロックも注意喚起も効かない「記録の欠落」型の抜け
