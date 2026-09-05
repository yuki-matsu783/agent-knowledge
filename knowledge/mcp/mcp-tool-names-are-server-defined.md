---
type: pitfall
nature: fact
title: MCP のツール名はサーバが定義するのでパターンによる種別分類は当たらない
description: >-
  Explains why a Claude Code guard should not classify MCP tools by name patterns such as
  `mcp__github__create_issue` into "issue write" or "PR write": the names are chosen by each server,
  another server exposes the same operation under a different name, and every pattern that does not match
  becomes false assurance. What a guard can enforce regardless of name is session state (has the workflow
  been declared), and a narrowly named target it must protect (a `draft: false` on `*pull_request*` /
  `*merge_request*`). Also records the over-denial that appears when `mcp__.*` is added to a matcher without
  a branch to receive it, and why WebFetch / WebSearch are left unenforced. Use when adding `mcp__.*` to a
  PreToolUse matcher. Not for MCP server authoring.
tags: [claude-code, mcp, security]
keywords: [MCP, mcp__, matcher, ツール名, サーバが定義, パターン分類, 誤った安心, 宣言の有無, 種別, remote-write, 過剰拒否, 入力不正, 外部委任モード, gh 不在, WebFetch, WebSearch, 負のコントロール]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/mcp
---

# MCP のツール名はサーバが定義するのでパターンで種別を分類しない

## 症状

`gh` / `glab` が使えない環境で MCP に切り替えた瞬間、`mcp__github__create_issue` / `add_issue_comment` / `update_pull_request` が「未宣言の拒否」も「宣言に無いリモート書き込みの拒否」も通らずに素通りした。
matcher に `mcp__.*` を持つ hook が 1 本 (draft 解除の検知用) しか無く、宣言を強制する hook と許可範囲を強制する hook はどちらも MCP を含まなかった。

逆に、その 1 本は「書き込みツール (対象パス)」「実行ツール (コマンド列)」「入力不正 → deny」の 3 分岐しか無く、MCP を受け止める分岐が無かった。
`mcp__github__get_issue` は `file_path` も `command` も持たないので「入力不正」に落ち、**すべての MCP 呼び出しが拒否**されて、フォールバック経路そのものが潰れていた。

## 原因

- **MCP のツール名はサーバが定義する。** `mcp__github__*` は名前から種別を推測できても、別のサーバが同じ操作を別名で提供する。パターンを書けば書くほど、当たらない名前に対して「守っている」という誤った安心が生まれる。記録の伏字化で「40 文字の乱数らしい語」を追いかけたのと同じ構造
- 誤分類の害が大きい。MCP は `gh` が使えないときの唯一のフォールバックで、正当な操作を止めるとワークフローが進まない
- 「判定できなければ拒否」の原則を、関わり得る範囲が静的に分かる入力にまで当てていた

## 回避策

- **宣言の有無は種別に依らず強制する。** 「振り分けを宣言したか」はセッション状態を見るだけで、何をする MCP ツールかを分類できなくても判定できる。宣言を強制する hook の matcher に `mcp__.*` を足す。安く確実に効く
- **種別 (issue 作成 / コメント / PR 編集) は宣言と突き合わせない。** 「外部の連携ツールを経由するリモート書き込みは種別を強制せず、計画タスクの自制に依存する」と要件に明記する。自制に依存する統制は明記が規約
- **守る対象を名指しする。** draft 解除だけは `mcp__*pull_request*` / `mcp__*merge_request*` で `draft` を false にする入力を deny、**それ以外の MCP は許可**、という明示の分岐を入力不正の前に置く。
  この hook が守るのは進行状態・置き場・draft 解除の 3 つで、MCP が触り得るのは draft 解除だけと静的に分かる。許可リストの保守 (サーバが増えるたびに機構を触る) より、守る対象を名指しする方が短い
- テストに負のコントロール (draft 解除以外の MCP が通る) を置く。「拒否されない」だけの assert は抽出の故障でも通る
- **WebFetch / WebSearch は強制しない。** コマンド列を前提にした分類関数をツール名だけの入力に当てられず、1 つの hook に 2 つの判定モデルを持たせることになる。副作用が読み取りに閉じており、止めた場合 (調査タスクが止まる) の害が守る利益を上回る。
  宣言は「意図の記録」として残す (計画時に外部を見る必要を考える契機になる)。コマンド側の `curl` / `wget` は別で、そちらは分類として強制する

## 再現条件

PreToolUse の matcher にツール名の正規表現を使う構成。MCP サーバの命名は公式 GitHub MCP サーバでも版で変わり得る。

## 関連

- [ガードの設定が読めないときも復旧経路を残す](../hooks/keep-recovery-path-when-guard-config-breaks.md)。「判定できなければ拒否」の適用範囲
- [読み取り専用に分類したコマンドはオプションで状態を変えたり任意実行したりする](../hooks/read-only-command-classes-have-option-holes.md)。コマンド側の `curl` の扱い
- [失敗メッセージに代替手段を名指しで埋め込む](name-the-alternative-in-failure-message.md)。MCP フォールバックへ誘導する側
