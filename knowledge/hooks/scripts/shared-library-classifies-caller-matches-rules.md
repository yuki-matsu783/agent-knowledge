---
type: pattern
nature: principle
title: 共有ライブラリの責務は分類までで規約との照合は呼び手のものであるべき
description: >-
  A responsibility boundary for libraries shared by several hooks: the library performs mechanical
  classification of input (which tool kind, which executable and subcommand, which operation class, which
  frontmatter value) and stops there; whether that value matches project rules (is this skill an entry
  skill, is this class declared on the ticket, which error id to deny with, is `-o`'s next word the output
  path) belongs to the calling hook. The library must not hold state files (two callers sharing "last
  push SHA" raced) and must not open files itself (it would break the fork budget). Use when the same check
  appears in a library and in a caller, or when a library needs to know a caller's identifiers. Not for
  single-caller helper functions.
tags: [workflow, tool-use]
keywords: [共有ライブラリ, 分類, 照合, 呼び手, 二重定義, 責務の境界, 状態ファイル, レース, 識別子, tool_class, cmdpos, scope_classify, frontmatter, 位置引数, 意味論, hook-common]
status: stable
sources: []
intervention: hook
---

# 共有ライブラリの責務は分類までで規約との照合は呼び手のものであるべき

## 課題

複数の hook が `source` する共有ライブラリの関数が、ツール名の分類の中で「スキル名が `00-workflow-*` で始まれば振り分けの宣言」という**プロジェクトの規約**を接頭辞判定で持っていた。
一方で振り分けスキル名の正は別ファイルの列挙で、照合するのは特定の hook。同じ規約が 2 か所にあり、`00-workflow-hotfix` を足したときにどちらかだけ更新される。

別の関数では、push 検知のライブラリが「前回 push の SHA」を状態ファイルから読み、呼び手の 1 本がそれを更新していた。同じライブラリを使うもう 1 本は、
[並列に走る](../common/hooks-run-in-parallel-not-in-array-order.md) 相手が先に更新すると検知が偽になり、レポートが時々出なかった。

## 解決

ライブラリの責務を**入力の機械的な分類まで**に線を引く。「その値がプロジェクトの規約に照らして正しいか」の照合は呼び手が行う。

| ライブラリの関数 | やること (分類) | やらないこと (照合。呼び手の責務) |
|---|---|---|
| ツール種別の分類 | ツール名から書き込み / 実行 / 宣言 / 読み取り を返す。`Skill` は名前を見ずに常に「宣言の候補」 | その名前が振り分けスキルかの照合 (呼び手が列挙ファイルで行う) |
| コマンド分割 | 実行位置のセグメント・実行体・第 1 サブコマンド・オプションを除いた位置引数を返す | そのコマンドを許してよいかの判断、`rm` の元と `mv` の宛先の解釈、`-o` の次が出力先という意味論 |
| 操作の分類 | 操作の分類 (`read` / `build-test` / `remote-write:*` / `provided`) を返す | その分類がチケットに宣言されているかの判断 |
| frontmatter 読み取り | 値を返す (読めた / キー無し / ライブラリ不在 を戻り値で区別) | 値が仕様どおりかの検証 (種類が設定に存在するか等) |
| push 検知 | コマンド列と upstream から「push が成功したか」を返す。**進捗の起点 (前回どこまで進んだか) は呼び手が引数で渡す** | 状態ファイルの読み書き |
| JSON の読み込み | 共通ライブラリが取り出した値を詰め替える | パスを引数に取って自分で開く (fork 予算を関数の側から破れる) |

理由は 3 つ。**二重定義は必ず片方だけ更新される**。**分類と照合では変わる理由が違う** (ツールの種類は Claude Code 側の都合、スキル名はプロジェクトの都合)。
**ライブラリは呼び手の識別子を知らない** (同じ判定を使う 2 本の hook で拒否の識別子の番号が違う)。

## 適用条件

- 効く: 3 本以上の hook が共有する判定ライブラリ。ライブラリに規約の値 (名前・接頭辞・許可リスト) やファイル I/O を入れたくなったとき
- 効かない: 呼び手が 1 つの補助関数。線引きのコストに見合わない
- ライブラリにファイルを読ませる案 (`tool_class` に列挙ファイルを読ませる) は、ホットパスの I/O が増え、読めなかったときの失敗ポリシーをライブラリが決めることになる

## トレードオフ

- 得る: 正が 1 つになる。hook が何本増えても、どの順で走っても互いに影響しない (起点を引数にした push 検知)
- 失う: 呼び手ごとに照合のコードが要る。接頭辞判定のような「粗いが 1 行で済む」近道を捨てる

## 関連

- [同じイベントの hook は並列に走り settings.json の配列順は実行順ではない](../common/hooks-run-in-parallel-not-in-array-order.md)。状態を持つライブラリがレースする理由
- [source するライブラリの戻り値規約](bash-return-code-conventions-for-sourced-libs.md)。frontmatter 読み取りの 3 状態と、失敗ポリシーを呼び手に委ねる形
- [ホットパスの hook は秒数ではなく fork の回数で予算を決める](count-forks-not-seconds-for-hot-path-hooks.md)。ライブラリがファイルを開かない理由
- [意味理解を要する判定はエージェントへ委ねスクリプトには決定的な判定だけを置く](../../skills/scripts/delegate-meaning-to-agent-keep-scripts-decidable.md)。1 段上の同じ線引き
