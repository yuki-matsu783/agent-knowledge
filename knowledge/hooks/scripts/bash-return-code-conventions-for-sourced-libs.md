---
type: pattern
nature: best-practice
title: source するライブラリは読み込み失敗を呼び手に委ね戻り値で 3 状態を返すべき
description: >-
  Conventions for pure-bash libraries sourced by hooks and scripts under `set -euo pipefail`: the load line
  takes a failure policy (nop / fatal / deny) chosen by the caller rather than one baked into the library,
  because the same library serves guards that must deny and advisors that must stay silent; when the library
  is missing, stub functions return 2 so callers can tell "library absent" (mechanism broken) from 1 "key
  absent" (record malformed) and 0 "value read"; loaders alone use that 0/1/2 scheme, predicates return
  true/false, and judgment functions return 0 with results in variables. Also the two ways bash silently
  drops a return code: `local v=$(f)` and `|| true`. Use when writing or calling such a library. Not for
  standalone scripts' exit codes.
tags: [workflow, tool-use]
keywords: [bash, source, 読み込み行, 失敗ポリシー, nop, fatal, deny, スタブ, 戻り値 2, 3 状態, set -e, local と代入, "|| true", "|| rc=$?", コマンド置換, 述語, 判定関数, FM_AVAILABLE, 機構の破損, 記載不正]
status: stable
sources:
  - https://www.gnu.org/software/bash/manual/html_node/Bash-Builtins.html
intervention: hook
---

# source するライブラリは読み込み失敗を呼び手に委ね戻り値で 3 状態を返す

## 課題

許可範囲を判定するライブラリが、チケットの frontmatter を読むために別のライブラリを `source` する。その読み込み行のポリシーを「読めなければ deny を出して終了」にしていたところ、
同じライブラリを使う案内側の hook 2 本が「依存が壊れたら何も出さずに通す」原則に反した。しかも PostToolUse では `permissionDecision` が無視されるので、deny を出しても止まらず誤解を招く記録だけが増える。

ポリシーを「読めなければ空を返すスタブ」に変えると、今度は**機構の破損** (ライブラリが読めない → `.claude/` の状態を確認せよ) と**記載不正** (frontmatter は読めたがキーが無い → チケットを直せ) を呼び手が区別できない。
どちらも `fm_get` が空を返す。回復の案内が違うので取り違えると、エージェントがチケットを直そうとして直らない。

さらに参考実装は `SC_TYPE="$(fm_get "$f" type 2>/dev/null || true)"` と書いていて、戻り値で区別できたとしても呼び手で消えていた。

## 解決

1. **読み込み行の失敗ポリシーは呼び手が引数で決める** (`nop` / `fatal` / `deny`)。ライブラリ側が一律のポリシーを持つ設計が誤り。`nop` は「判断しない」なので、どちらの呼び手にも矛盾しない。
   拒否側 hook は自分で deny に倒し、案内側は何も出さずに通す。読めなかった事実は読み込み行が `FM_AVAILABLE=0` に置く (読み込めていないときに実行されるのはスタブなので、ライブラリ自身には設定させられない)
2. **読めないときのスタブは出力なし・戻り値 2。** 3 状態: 0 = 値を読めた / 1 = frontmatter は読めたがキーが無い・対象外の形 / 2 = ライブラリを読み込めていない。
   提供コマンドの終了コード (0 成功 / 1 前提未充足 / 2 引数や環境の誤り) と揃うので新しい約束を覚えなくてよい。空文字列に特別な値 (`__UNAVAILABLE__`) を入れる案は値として使われると壊れる
3. **戻り値の規約は読み込み系の関数だけに適用する。** 述語 (`scope_match`) は真偽 (一致 0 / 不一致 1) を返し `if scope_match …; then` と書ける。判定関数の戻り値は常に 0 で、結果 (`SC_DECISION` / `SC_ID` / 段階番号) は変数に置く。
   bash の戻り値は 1 バイトの整数 1 つしか返せないので、「読めたか」「判定結果」「段階番号」を同時には返せない。読み込みの成否だけを戻り値に、残りを変数に、という分け方は読み込みと判定を別関数にしたことの自然な帰結。
   判定結果 (deny = 非 0) を戻り値にすると `set -e` の下で本体が落ち、呼び手が毎回 `|| rc=$?` で受けることになる
4. **呼び出し規約を書き方まで降ろす。** 「潰さない」は方針ではなく書き方の問題で、方針だけ書いても `set -e` を使う以上どこかで受けざるを得ず、受け方を決めないと `|| true` に落ちる
   - `local v=$(f)` と書かない。`local` 自身の終了ステータス (常に 0) が `$?` になり、戻り値が黙って消える。`local v; v="$(f)" || rc=$?` と 2 行に分ける
   - `|| true` を使わない。`|| rc=$?` で受けて分岐する。戻り値を使わない呼び出しでも `|| rc=$?` で受け、無視すると決めたことがコードから読めるようにする
   - パイプやコマンド置換の中で呼ばない。`$(...)` の中の非 0 は `set -e` の対象外になり、判定が静かに変わる
5. ライブラリ側は 1 と 2 を潰さず、そのまま呼び手へ返す。`scope_load_ticket` が「ファイル不在」「種類が空」「スタブ」を全部 `return 1` に畳んでいた箇所を分ける

## 適用条件

- 効く: `set -euo pipefail` の下で動く hook と提供コマンドが共有する純 bash ライブラリ
- 効かない: `set -e` を使わないスクリプト (ただし `local v=$(f)` の罠は `set -e` と無関係に効く)
- ラッパー関数 (`fm_try` で戻り値を `FM_RC` に置く) は呼び出し面が 2 系統になる。書き方の規約で足りる

## トレードオフ

- 得る: 機構の破損と記載不正が別の識別子・別の回復案内になる。呼び手が確認を忘れても 2 が返って安全側に倒れる
- 失う: 呼び出しが 2 行になる。`|| rc=$?` が全呼び出しに付く

## 関連

- [共有ライブラリは分類までにし規約との照合は呼び手が行う](shared-library-classifies-caller-matches-rules.md)。ライブラリが呼び手の識別子 (WF2xx / WF3xx) を知らないので、識別子まで決めて返せない
- [コピーした定型行はバイト一致をテストで固定する](test-byte-equality-of-copied-boilerplate.md)。読み込み行を 20 本以上にコピーしたときの話
- [hook を注入系とガード系に分け、失敗時の既定を逆にする](injecting-vs-guarding-hooks.md)。呼び手ごとにポリシーが違う理由
