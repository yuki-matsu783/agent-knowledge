---
type: pitfall
nature: insight
title: hook の前置フィルタで穴が開くのは生 JSON のエスケープで精密判定の超集合でなくなるから
description: >-
  Explains why a cheap pre-filter placed before a PreToolUse guard's jq parsing (to avoid 5-7 execs on every
  tool call) can silently disable the guard: the filter sees the raw JSON payload, not the decoded command, so
  `git com\<newline>mit` arrives as `com\\\nmit`, and stripping only backslashes leaves `comnmit`, which never
  matches; likewise `${raw,,}` needs bash 4 and aborts the whole hook on older shells before any fallback runs.
  Use when adding a `case "$raw" in *commit*)` fast path to a hook, or when a guard stopped firing after a
  performance change. Not for the precise judgement itself, which stays in the main matcher, and not for
  deliberate quoted splitting, which the precise matcher already ignores.
tags: [claude-code, security, workflow]
keywords: [前置フィルタ, 超集合, superset, "read -r -d ''", case, 部分一致, "JSON エスケープ", バックスラッシュ, "backslash n", "com\\mit", "raw lowercase expansion", "bash 4.0", ブラケット式, execve, clone, strace, fork, 空振り, PreToolUse, PostToolUse]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# hook の前置フィルタは精密判定の超集合でなければ生 JSON のエスケープで穴が開く

## 症状

すべての Bash 呼び出しで起動する hook が、判定本体へ辿り着く前の材料取り出し (`raw="$(cat)"` と `printf | jq` の連鎖) だけで
空振り 1 回あたり execve 5〜7 回・clone 10〜17 回を使う (strace 実測)。git bash では外部プロセス起動が約 95ms/回なので数百 ms を捨てている。

そこで `IFS= read -r -d '' raw` (bash 組み込み、fork 無し) で読み、`case "$raw" in *commit*) ;; *) exit 0 ;; esac` で足切りする前置フィルタを入れると、
**精密判定なら止めるはずの入力を jq へ渡す前に通してしまう**ケースが 2 層で見つかった。

## 原因

前置フィルタが精密判定の**超集合**でない (精密判定が拾う入力を取りこぼす) と、判定本体が実行されなくなり、ガードの無効化そのものになる。
過剰検知は後段の jq へ回るだけで実害が無いので、設計の最優先は「精密さ」ではなく「1 件も取りこぼさないこと」。

1. **シェルのエスケープ層。** 精密判定は `\x` (x が英数字等) のバックスラッシュを落として x を残す正規化を持つので、`git com\mit -m x` は `commit` として検知する。
   生の文字列には `commit` という連続が無いので `*commit*` は通してしまう
2. **JSON エンコード層。** 前置フィルタが受け取るのは jq がデコードする**前**の生 JSON。実コマンド `git com\<改行>mit` は JSON 上 `com\\\nmit`
   (バックスラッシュ 3 つ + n) になる。バックスラッシュだけ除くと `\n` の `n` が単独で残って `comnmit` になり、やはり一致しない

さらに `${raw,,}` (小文字化) は bash 4.0 以降の構文で、`main()` 冒頭に置くと**古い bash では展開自体がエラーになって hook プロセスが丸ごと終了する**。
判定本体の直前にある `BASH_VERSINFO` によるフォールバック分岐に到達できない。

## 回避策

- 前置フィルタは独立した純粋関数にして、`source` して直接呼ぶ単体テストを書く
- 比較の前に、JSON 文字列エスケープの 2 文字シーケンス (`\\` `\"` `\n` `\t` `\r` `\/` `\b` `\f`) を**2 文字ともまとめて**除いてから、残ったバックスラッシュ
  (`\uXXXX` 等) を落とす。`\\` を最初に処理する (bash の `${var//pattern/}` は左から右への非重複マッチなので、長いパターンを先にすれば JSON デコードと同じ分解になる)。
  除去は「マッチする可能性のある文字列を増やす」方向にしか働かないので超集合を壊さない
- 大文字小文字非依存の比較はブラケット式 (`*[Cc][Oo][Mm][Mm][Ii][Tt]*`) で書く。bash 2.0 から動き、バージョン分岐が要らない
- 判定本体は変えない。前置フィルタは高速な足切りで、正しさの根拠は判定本体が持つ
- 精密判定が対象外にしているもの (クォート断片の連結 `git 'com''mit'`) まで前置フィルタが拾う必要は無い

結果: execve 5→1・clone 10→0 (Linux 実測)。ただし `read -r -d ''` はパイプ入力を 1 バイトずつ read(2) するので、巨大なヒアドキュメントでは
入力バイト数に比例して増える。小さいペイロード (60 バイト程度) でしか測っていない。

## 再現条件

Linux x86_64 (Claude Code on the web) で strace 実測、2026-08。git bash (Windows, MSYS) の数値と一致したが、システムコール構成が違うので偶然の一致として扱う。
2 つの反例はいずれも敵対的レビュー (独立コンテキストのサブエージェント) で見つかった。

## 関連

- [hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒す](command-position-match-fails-closed.md)。後段の精密判定
- [敵対的レビューは独立コンテキストの読み取り専用サブエージェントに切り出す](../../agents/adversarial-review-in-isolated-subagent.md)
- [タイムアウトした hook はガードにならず素通りする](../common/hook-timeout-fails-open.md)
