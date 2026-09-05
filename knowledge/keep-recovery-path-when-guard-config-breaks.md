---
type: pattern
title: ガードの設定が読めないときも復旧経路を残す
description: >-
  A design rule for fail-closed Claude Code guards: "deny when you cannot decide" applies only when the
  operation might touch something the guard protects and the guard genuinely cannot tell, not when a
  config file is corrupt (fall back to defaults and keep judging), not when the tool's reach is statically
  known (MCP tools that cannot touch protected state get an explicit allow branch), and never in a way that
  closes the path someone needs to fix the config. Because hooks run in parallel, one guard denying kills
  the recovery path another guard carefully left open, so the path is a contract across all guards. Use
  when writing the "input invalid" or "config unreadable" branch of a guard, or when a broken config
  locked the agent out. Not for the case where the config is fine and the operation is really ambiguous.
tags: [claude-code, security]
keywords: [ガード, hook, 設定破損, 既定値, 復旧経路, ロックアウト, 判定不能は拒否, 過剰拒否, MCP, 入力不正, 負のコントロール, 並列, 宣言漏れ, read は常に許可, ヘッドレス, WF210]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
---

# ガードの設定が読めないときも復旧経路を残す

## 課題

拒否側の hook は「判定できなければ拒否側に倒す」を原則にする。ところが原則を機械的に当てると、設定ファイル 1 つの破損が**完全なロックアウト**になる。

- 許可範囲を判定する guard は、設定が壊れたら「設定破損」の識別子を出しつつ、復旧経路 (提供コマンドの実行、チケット置き場への書き込み、**設定ファイル自身への ask 付きの書き込み**) だけは通す設計だった
- 進行状態を守る別の guard には「設定が読めない」分岐が無く、原則どおり「入力不正 → deny」に落ちる
- [hook は並列に走る](hooks-run-in-parallel-not-in-array-order.md) ので deny はどれか 1 本でも出れば成立する。片方が用意した復旧経路を、もう片方が潰す

同じ構造の穴が 3 つ見つかった。相対パス登録による全 deny、設定破損時の拒否、`jq --slurpfile` の副入力破損。どれも「機構が自分を止めて回復手段を奪う」形をしている。

## 解決

「拒否に倒す」原則の適用範囲を明文化し、外れる場合を 3 つ決める。

1. **設定が読めないのは「判断できない」ではなく「設定が壊れている」。** 保護対象の一覧のように既定値を仕様が知っているものは、既定値にフォールバックして判定を続け、フォールバックした旨を記録する。
   「保護対象をコードに埋め込まない」規約には「設定が読めないときの既定値は例外」と但し書きを足す。既定値が実際と食い違っていても害は小さい (多く守れば復旧の書き込みが 1 つ止まるだけ、少なく守れば破損中の一瞬だけ緩む)。
   既定値を別ファイルに外出しすると「設定が読めない状況で別の設定を読む」ことになり、同じ問題が 1 段深くなるだけ
2. **関わり得る範囲が静的に分かるものは「入力不正」に落とさない。** MCP ツールは書き込みツールでも実行ツールでもなく `file_path` も `command` も持たないので、分岐が無いと全 MCP 呼び出しが入力不正で拒否され、
   `gh` 不在時のフォールバック経路が潰れる。この guard が守るのは進行状態と draft 解除だけで、MCP が触り得るのは draft 解除だけと静的に分かる。明示の分岐 (`*pull_request*` / `*merge_request*` で `draft: false` → deny、それ以外の MCP → allow) を置き、
   「拒否されない」だけの assert は抽出の故障でも通るので、**負のコントロール** (draft 解除以外の MCP が通る) をテストに置く
3. **読むだけの操作と機構自身の状態遷移は宣言に依らず常に許可する。** 宣言漏れで「ファイルを読む」「完了コマンドを打つ」が止まると、ヘッドレスでは宣言漏れ 1 つでセッションが終わる。
   「宣言し忘れたチケットは完了できない」という行き止まりを作らない

復旧経路は 1 本の guard の設計ではなく**全 guard の合意**として仕様に書く。「設定自身への書き込みは通す」を、それを読まない guard が拒否したら意味が無い。

## 適用条件

- 効く: 複数の拒否側 hook が同じイベントに並ぶ構成、設定ファイルをエージェントが書き換え得る構成、ヘッドレス実行
- 効かない: 設定は読めていて、操作そのものが保護対象に関わり得るのに判断できない場合。ここは原則どおり拒否側に倒す

## トレードオフ

- 得る: 設定破損・登録ミス・副入力の破損が「直せる失敗」に留まる。過剰拒否が「守っている」ように見えて正当な経路を潰すだけ、という状態を避ける
- 失う: 既定値がコードに 1 か所入る。「守る対象に関わり得るか」の静的な判断を guard ごとに書く手間

## 関連

- [hook は CLAUDE_PROJECT_DIR 基準の絶対パスで登録しないと cwd 次第で全 deny のロックアウトになる](register-hooks-with-absolute-project-dir-path.md)。ロックアウト経路の 1 つ目
- [jq の --slurpfile は副入力が壊れていると呼び出し全体を失敗させ stdin の解析まで失う](jq-slurpfile-fails-whole-call-on-broken-side-input.md)。3 つ目。この分岐に到達できなくする
- [MCP のツール名はサーバが定義するのでパターンで種別を分類しない](mcp-tool-names-are-server-defined.md)。MCP の分岐の中身
- [hook を注入系とガード系に分け、失敗時の既定を逆にする](injecting-vs-guarding-hooks.md)。原則の側
