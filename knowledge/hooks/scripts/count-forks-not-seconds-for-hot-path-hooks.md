---
type: pattern
nature: heuristic
title: ホットパスの hook は秒数ではなく fork の回数で予算を決めた方がよさそう
description: >-
  A pattern for keeping PreToolUse guards that run on every tool call fast enough that they never hit
  the fail-open timeout: replace the untestable target "under one second" with a countable budget of
  external processes (only `jq`, at most twice per hook), resolve the repository root by walking up
  from BASH_SOURCE instead of `git rev-parse`, take timestamps with bash's `printf '%(...)T'`, pass fixed-path
  side inputs into the single stdin-parsing `jq` call, and let library functions receive already-parsed
  values rather than open files themselves, then assert the count in tests with a PATH shim that tallies
  invocations. Use when a hook's latency is measured in forks (Git Bash, ~95 ms each, multiplied by the
  number of parallel hooks). Not for advisory hooks that run after a tool succeeded, which may call git.
tags: [claude-code, cost, workflow]
keywords: [ホットパス, hook, fork, 外部プロセス, jq, 2 回, git rev-parse, BASH_SOURCE, 上向き探索, printf %T, make_counting_path, 回数を数える, 1 秒以内, Git Bash 95ms, 並列 5 本, --rawfile, 副入力, session_id]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
intervention: hook
---

# ホットパスの hook は秒数ではなく fork の回数で予算を決めた方がよさそう

## 課題

[打ち切りは fail-open](../common/hook-timeout-fails-open.md) なので、拒否側の hook を守る手段は速さだけになる。そこで仕様に「ホットパス 5 本は 1 秒以内」と書いたが、
これは**結果であって守り方ではない**。実装者が守れているか判断できず、テストにも落ちない。実行環境 (Windows / Linux、同時実行数) で値が変わるので回帰にも使えない。

しかも同じ仕様が「作業ツリーの位置は `git rev-parse --show-toplevel` を基準にする」と書いており、素直に読むと hook が毎回 git を起動する。
Git Bash では外部プロセス 1 回が約 95 ms で、[同一イベントの hook は並列に走る](../common/hooks-run-in-parallel-not-in-array-order.md) ので 5 本なら毎ツール呼び出しで 475 ms がそれだけで消える。

## 解決

「1 秒以内」は目安として残し、**検査できる上限**を併記する。

- **起動してよい外部プロセスは `jq` だけ、呼び出しは最大 2 回。** `git` / `date` / `sed` / `find` / `cat` を本体から呼ばない
  - 1 回目: stdin の hook 入力と、**パスが stdin に依存しない副入力** (上限設定など固定パスの JSON) を `--rawfile` で相乗りさせて読む
  - 2 回目: **`session_id` に依存するパス**の副入力 (セッションごとの承認の記憶など)。`session_id` は stdin を解析して初めて分かり、公式に環境変数で渡す手段が無いので 1 回目に混ぜられない。要る hook だけが呼ぶ
  - 「次に別の設定が要ったら 3 回」にはならない。固定パスの副入力はいくつ増えても 1 回目に相乗りできる。2 回目は実行基盤の性質から出る最小の回数で、内訳を固定しておけば上限は制約として働き続ける
- リポジトリルートは `${BASH_SOURCE[0]}` から `.claude` を持つ親を上向きに探す (fork なし)。`git rev-parse` は読み込み行の最終手段としてだけ使う
- 時刻は bash 組み込みの `printf '%(%Y-%m-%dT%H:%M:%S)T'` で取る
- パス照合とコマンド分割は純 bash で書く
- **ライブラリの読み込み関数はファイルを開かない。** 共通ライブラリが既に取り出した値を受け取って詰め替えるだけにする。パスを引数に取る形を残すと、実装者が善意でそこで `jq` を呼び、テストが落ちてから気づく。純 bash で読める frontmatter だけは例外
- 回数はテストで数える。`PATH` の先頭に `jq` の名前で呼び出しを記録するシムを置き、hook を 1 回走らせて回数を assert する

実測 (登録後、静かな状態): hook 5 本がそれぞれ 323〜642 ms。負荷中 (全件テストを 2 本同時に走らせている最中) の測定は同じマシンで約 1.9 秒と出ており、測定環境の統制も規約に含める。

## 適用条件

- 効く: 毎ツール呼び出しで走る PreToolUse / UserPromptSubmit の拒否側 hook
- 効かない: ツールの成否が確定した後に走る案内側 hook (`post-push-*`、SessionStart)。git を呼ぶ必要があり、上限の対象外にする
- `jq` も禁止して純 bash の JSON パーサを書く案は採らない。stdin の JSON は入れ子とエスケープを含み、自作パーサは壊れやすい

## トレードオフ

- 得る: 上限が環境に依らず決まり、CI でも回帰でも同じテストで固定できる。「上限を守っていても遅い」ケースは実測で別途拾う
- 失う: 上限を破らずに機能を足す設計の手間。上限は「fork をこれ以上増やさない」圧力として働くもので、要求のたびに緩めると意味を失う
- `jq` の副入力に `--slurpfile` を使うと、副入力の破損で呼び出し全体が失敗する ([jq の --slurpfile は副入力が壊れていると呼び出し全体を失敗させる](jq-slurpfile-fails-whole-call-on-broken-side-input.md))

## 関連

- [hook の前置フィルタは精密判定の超集合でなければ生 JSON のエスケープで穴が開く](../20-PreToolUse/hook-prefilter-must-stay-superset.md)。fork ゼロの前置フィルタも同じ回数検査で固定している
- [bash のパターン照合に入力由来の長い文字列を置くと二乗で遅くなる](bash-pattern-expansion-with-long-literal-is-quadratic.md)。fork ゼロでも遅くなる別の原因
- [hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒す](../20-PreToolUse/command-position-match-fails-closed.md)。純 bash のコマンド分割
