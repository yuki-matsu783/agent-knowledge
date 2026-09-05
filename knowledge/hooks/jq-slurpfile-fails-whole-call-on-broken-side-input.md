---
type: pitfall
nature: fact
title: jq の --slurpfile は副入力が壊れていると呼び出し全体を失敗させ stdin の解析まで失う
description: >-
  Explains why passing a config file to `jq --slurpfile` inside a hook turns one corrupt or missing JSON
  file into a total lockout: jq parses the side input before evaluating the filter, exits 2 with empty
  stdout, and the hook loses even `tool_name` and `session_id` from stdin, so a guard that meant to
  "fall back to defaults when config is broken" never reaches that branch. Use when a hook reads stdin
  plus one or more JSON files in a single `jq` call. Shows the fix: `[ -f ]` then `--rawfile` with
  `fromjson? // null` (or `--argjson name null` when absent) and a per-input state variable the caller
  decides on. Not for jq filter syntax in general.
tags: [claude-code, security, tool-use]
keywords: [jq, --slurpfile, --rawfile, fromjson, --argjson, Bad JSON in --slurpfile, exit 2, stdout 空, 副入力, 設定破損, ロックアウト, hook, scope-limits, HC_STATE, missing, broken]
status: stable
sources:
  - https://jqlang.github.io/jq/manual/
---

# jq の --slurpfile は副入力が壊れていると呼び出し全体を失敗させ stdin の解析まで失う

## 症状

hook が stdin の入力と設定ファイルを 1 回の `jq` で読む形にしたところ、設定ファイルを壊した (または消した) だけで
**すべてのツール呼び出しが拒否**されるようになった。「設定が読めないときは既定値で判定を続ける」「復旧のために設定自身への書き込みは通す」と
仕様に書いてある分岐に、一度も到達しない。

```
$ printf '{"bad"' > bad.json
$ echo '{"a":1}' | jq --slurpfile lim bad.json '.a'
jq: Bad JSON in --slurpfile lim bad.json: Unfinished JSON term at EOF at line 1, column 6
exit=2      # stdout は空

$ echo '{"a":1}' | jq --slurpfile lim missing.json '.a'
jq: Bad JSON in --slurpfile lim missing.json: Could not open missing.json: …
exit=2      # stdout は空
```

## 原因

`--slurpfile` は副入力をパースしてから本体のフィルタを評価する。副入力が壊れていれば**呼び出し全体が失敗し、stdin の解析結果 (`tool_name` / `tool_input` / `session_id`) すら得られない**。
拒否側の hook は「判定できない」と「入力すら読めない」を区別できず、縮退の設計が成立しない。
別の hook が塞いだロックアウト経路 (設定破損を拒否に倒さない) を、`jq` の呼び出し方が別の形で開け直していた。

## 回避策

存在するファイルだけを文字列として渡し、`jq` の中で解釈する。

```bash
args=()
if [ -f "$limits" ]; then args+=(--rawfile lim "$limits"); else args+=(--argjson lim null); fi
jq -r "${args[@]}" '{a: .a, lim: (($lim | fromjson?) // null)} | @json'
```

```
$ echo '{"a":1}' | jq -r --rawfile lim bad.json '{a:.a, lim:(($lim|fromjson?) // null)} | @json'
{"a":1,"lim":null}
exit=0
```

- `[ -f ]` は bash 組み込みなので fork が増えない ([fork の回数で予算を決める](count-forks-not-seconds-for-hot-path-hooks.md) と両立する)
- `fromjson?` は失敗を握るだけで隠さない。`// null` の結果を副入力ごとの状態変数 (`ok` / `missing` / `broken`) に写し、**どう扱うかは呼び手の hook が決める**。
  拒否側の guard は「設定破損」の識別子で復旧経路だけ通し、状態ファイルを守る guard は既定値で判定を続ける
- 呼び出し前に `jq -e . <file>` で検証する案は `jq` が 1 回増え、検証と本番の間に壊れる余地も残る。失敗したら stdin だけで呼び直す案は、壊れているときこそ遅くなる方に倒れる。
  `$(cat file)` で読んで `--arg` に渡す案は `cat` が fork で、`$(< file)` でも設定が育つと引数長の制限に当たる

`jq` の `//` 演算子は `false` も右辺に倒すことにも注意する。`.draft // empty` は「draft でない」を「判定できない」に化けさせる。値の有無と値そのものは分けて読む
([判定できないときは「進んだことにする」でなく「もう一度やる」側に倒す](../skills/undeterminable-means-redo-not-assume-done.md))。

## 再現条件

jq 1.6 以降の `--slurpfile` / `--rawfile` の挙動。上の出力は Git Bash 上で確認されたもの。

## 関連

- [ガードの設定が読めないときも復旧経路を残す](keep-recovery-path-when-guard-config-breaks.md)。この分岐に到達させるための話
- [ホットパスの hook は秒数ではなく fork の回数で予算を決める](count-forks-not-seconds-for-hot-path-hooks.md)。副入力を 1 回の jq に相乗りさせる理由
- [hook は CLAUDE_PROJECT_DIR 基準の絶対パスで登録しないと cwd 次第で全 deny のロックアウトになる](register-hooks-with-absolute-project-dir-path.md)。同じ形のロックアウト
