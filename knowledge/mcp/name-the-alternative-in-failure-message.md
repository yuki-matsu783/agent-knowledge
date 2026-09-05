---
type: pattern
nature: best-practice
title: 失敗メッセージには代替手段を名指しで埋め込むべき
description: >-
  A pattern for scripts that depend on a tool the agent's environment may lack (gh/glab CLI missing on
  Claude Code on the web): detect the access mode from `command -v`, and when the CLI is absent make every
  dependent function fail with a stderr message that names the exact MCP tool and arguments to use instead,
  where to get owner/repo, which document section has the mapping table, and what not to fall back to
  (WebFetch, curl). A rule in AGENTS.md saying "MCP may be used instead" was already there and was still
  improvised around, because a rule that is not read does not work. Use when an agent keeps choosing tools ad
  hoc in degraded environments. Not for tools with no substitute, where the message should say "skip this
  step", and not a transparent shim that calls MCP from bash, which is impossible.
tags: [claude-code, mcp, tool-use]
keywords: [gh, glab, CLI 不在, MCP フォールバック, require_vcs_cli, command -v, 代替手段, stderr, 名指し, 読み替え表, mcp__github__, WebFetch を使わない, Claude Code on the web, 縮退, 経路判定, 即興判断]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: tool
---

# 失敗メッセージに代替手段を名指しで埋め込む

## 課題

共通ルールには以前から「`gh` / `glab` CLI が無い環境では GitHub 公式の MCP サーバーツールで代替してよい」と書いてあった。
それでも skill・hook・スクリプトのどこにも MCP への言及が無く、「どの関数をどのツールへ読み替えるか」が未定義だったため、
エージェントは毎回その場の判断でツールを選んでいた。**書いてあるのに読まれなければ機能しない**対策は同じ失敗を繰り返す。

同じ環境で SessionStart hook は失敗を握りつぶし、PR があるのに「PR: なし」と誤った情報を注入していた。

## 解決

1. **経路判定を関数にする。** `command -v gh` / `command -v glab` の結果から `cli` / `mcp` を返す。判定はエージェントの主観ではなく実行環境の事実
2. **CLI 経路の関数は、CLI 不在時に「代替手段を名指しして」失敗する。** プロバイダ依存の各関数の先頭でガードを呼び、stderr へ次を出して終了コード 1 を返す
   - 代替すべき MCP ツール名と引数
   - owner / repo の取得方法 (`git remote` から導ける)
   - 対応表がある文書の節
   - WebFetch / curl へはフォールバックしない旨
   手順を読まずに CLI を呼んだ場合でも、同じ案内へ収束する
3. **対応表は 1 箇所に置く** (skill 本体)。仕様やスクリプトのコメントには要約だけ
4. **ローカル操作で足りる関数はガードの例外にする。** リポジトリ URL は `git remote get-url origin` で導けるので、MCP 経路でも動かして
   「リンクが 1 本欠ける」程度の縮退に留める
5. **代替が無い関数は「スキップしてよい」と名指しする。** 添付アップロードのように読み替え先が無いものは、唯一「代替無し」のヒントを返す
6. **拒否の文面は、正しく拒否したときだけでなく縮退で拒否したときにも読めるように書く。** 材料が揃わず拒否側に倒した場合に
   「禁止コマンドの実行」と断定する文面を出すと、文書に禁止語を書いただけの読み手は次の一手を 1 つも得られない。
   縮退なら「何が判定を妨げたか (ヒアドキュメント・変数展開・クォート)」を理由に添える

## 適用条件

- 効く: 実行環境によって道具の有無が変わり、代替が MCP ツールなど「エージェントのツール呼び出しとしてのみ発火する」ものであるとき
- 効かない: bash から透過的に MCP を呼ぶ案。MCP ツールはスクリプトのプロセスからは呼べず、HTTP / JSON-RPC の独自クライアントと認証の取り回しが要る。
  それは避けたかった「独自の生 API 呼び出し」に近づく

## トレードオフ

- 得る: 実行時に必ず目に入る場所へ誘導が乗る。ドキュメントを読んだかどうかに依存しない
- 失う: 各関数の先頭にガードが 1 行増える。CLI 不在時に「空を返して成功」する既存の縮退は誤情報を生むので、意図的に失敗へ変える必要がある

## 関連

- [エージェントが呼ぶスクリプトは無言で成功してはならない](../skill/agent-scripts-must-not-succeed-silently.md)
- [操作をブロックするか注意喚起で済ませるかは特定可能性と代替経路で決める](../hook/block-vs-notice-hook-selection.md)。「読まれなければ機能しない」を機構で補う同じ考え方
- [権限は permissions.deny ではなく PreToolUse hook で止める](../hook/deny-by-hook-not-permissions.md)。deny の理由に代替を書くのも同じ発想
