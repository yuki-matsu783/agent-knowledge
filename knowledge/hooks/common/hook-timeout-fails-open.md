---
type: pitfall
nature: fact
title: タイムアウトした hook はガードにならず素通りする
description: >-
  Explains why a Claude Code hook that hits its timeout is canceled with its output discarded, so it
  renders no decision and the action proceeds anyway (fail-open), and how to design settings.json and
  hook scripts around that. Use when putting a guard, policy check, or approval gate in a PreToolUse
  or UserPromptSubmit hook, especially one that makes network calls or invokes a model. Not for hook
  matcher or JSON output schema problems, and not for permission rules configured outside hooks.
tags: [claude-code, security, workflow]
keywords: [hook, タイムアウト, timeout, fail-open, 素通り, ガード, PreToolUse, exit 2, exit 1, async, asyncRewake, prompt hook, agent hook, 外部通信, 600 秒, 登録ラッパ, trap ERR, 短い timeout は逆効果, permissions.deny は hook に関係なく評価, 多重防御]
status: stable
verified_at: 2026-09-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/settings
---

# タイムアウトした hook はガードにならず素通りする

## 症状

PreToolUse に置いたガード hook が、応答が遅かった回だけ何も止めずに通る。止めたかった書き込みや実行がそのまま行われる。
hook が落ちたわけではないので transcript にも目立つエラーが出ず、後から気づく。

外部 API を叩く hook、`type: "http"`、`type: "prompt"`、`type: "agent"`、command から LLM の CLI を呼ぶ hook で起きやすい。
どれも所要時間が入力とネットワーク次第で、上限が読めない。

## 原因

timeout に達した hook は cancel され、**出力ごと捨てられる**。出力が無いので decision も無い。

> Claude Code cancels a `command`, `http`, or `mcp_tool` hook that reaches its `timeout`, discarding the hook's output, so on most events a timed-out hook renders no decision.

PreToolUse では、判定が無い = 止めない、になる。公式リファレンスがそのまま釘を刺している。

> A timed-out `command`, `http`, or `mcp_tool` hook doesn't block the tool call. The call continues through the normal permission flow, so don't count on a stalled hook to act as a gate.

つまり hook は fail-open。遅延と失敗が「許可」に化ける。fail-closed になるのは次の 2 つだけ。

- PreModelSwitch は timeout で cancel されるとモデル切り替えを block する
- Agent SDK の callback hook は PreToolUse で timeout するとツール呼び出しを block する (settings.json の hook とは別物)

もう 1 つの罠が既定 timeout の長さ。`timeout` を書かないと最長 10 分固まる。

| hook type / event | 既定 timeout (秒) |
|---|---|
| `command` / `http` / `mcp_tool` | 600 |
| 同上、UserPromptSubmit・PreModelSwitch・PostModelSwitch | 30 |
| 同上、MessageDisplay | 10 |
| `prompt` | 30 |
| `agent` | 60 |
| SessionEnd | 1.5 (hook 全体の共有予算。per-hook `timeout` を長く書くと最大 60 まで上がる) |

`async: true` の command hook には `timeout` が効かない。

打ち切りは**プロセスごと終了させられて出力が捨てられる**ので、hook 側で用意した fail-closed の仕掛けも効かない。
登録コマンドを `bash guard.sh || printf '{"…deny…"}'` のようにラッパで包んでも、`trap ERR` で deny を出す構えにしても、
打ち切りではどちらも走らない。これらが効くのは「本体が起動できない」「本体が途中で異常終了した」ときだけで、フェイルクローズドの守りの中で打ち切りだけが穴として残る。

## 回避策

1. **ガードに使う hook はローカルで完結させる。** lint、パス判定、ファイル読み書きだけにする。所要時間が入力サイズに比例する範囲に収める
2. **外部通信を入れない。** hook はセッションの同期パスにいる。DNS の失敗、TLS のハンドシェイク待ち、プロキシの詰まりが、そのままセッションの停止と素通りになる
3. **LLM を呼ぶ hook をガードにしない。** `type: "prompt"` と `type: "agent"` は公式機能だが、レイテンシが読めない点は外部通信と同じで、fail-open と相性が悪い。判定を外したくないなら hook ではなく permission ルールか、Claude 側の指示で担保する
4. **それでも入れるなら、Claude Code の timeout に到達させない。**
   - hook スクリプト側に自前のタイムアウトを置き、`settings.json` の `timeout` より短くする。先に自分でタイムアウトを検知して `exit 2` で塞ぐ。これで fail-open が fail-closed に変わる
   - `settings.json` の `timeout` を**短く明示するだけ**では逆効果になる。打ち切りが fail-open である以上、短くするほど「判定を諦めて通す」確率が上がる。短い `timeout` は上の自前タイムアウトと組にしてはじめて意味を持つ
   - 通信の失敗も同じく hook 内で握り、「判定できなかった」を `exit 2` の理由として stderr に書く
   - リトライを入れない。リトライは所要時間を掛け算で伸ばす
   - ローカルで完結する軽い判定なら、`timeout` を触るより「外部プロセスを起こさない」で速さを保つ方が確実。所要時間は環境で揺れるが fork の回数は揺れない
5. **ブロックしない用途 (通知、ログ送信) は `async: true` で背景に出す。** セッションを止めない。`asyncRewake: true` にすると exit 2 のときだけ Claude を起こせる
6. **止めたいなら `exit 2`。** `exit 1` は non-blocking error として扱われ、stdout に有効な JSON が無ければ処理はそのまま進む。ガード hook の末尾に `|| true` を付けない (index の再生成のような、止める意図の無い hook なら付けてよい)

このリポジトリの `.claude/hooks/protect-generated.sh` と `lint-on-edit.sh` は 1 と 6 に沿っている。どちらもローカルの `jq` と `node` だけで、`timeout` を 10 秒と 60 秒に明示し、違反は `exit 2` で返す。

### hook の外側の多重防御

`permissions` の deny / ask ルールは hook の結果に関係なく評価される (公式: "Deny and ask rules are still evaluated regardless of what the hook returns")。
打ち切りの影響を受けないので、hook と併用する多重防御にはなる。ただし単純なコマンドの一部しか止められず、`a && b` のような複合コマンドは通るので、
これに寄せると「止まったつもりで止まっていない」状態を作る。hook の穴を埋める目的で permissions に規則を並べない。

`PostToolBatch` の exit 2 は次のモデル呼び出しの前で agentic loop を止められるが、打ち切られた PreToolUse の後始末としては遅い。
push や issue への投稿やファイル削除は既に起きている。「実行前に止める」用途には役に立たない。

## 再現条件

claude-code@2.1.235。挙動と既定値は公式 hooks リファレンス (2026-09 時点) の記述による。
`timeout` の既定と fail-open/fail-closed は event と hook type ごとに違うので、`settings.json` を書くたびに上の表を見る。

## 関連

- [hook を注入系とガード系に分け、失敗時の既定を逆にする](injecting-vs-guarding-hooks.md)。ガード側の exit 2 の考え方
- [権限は permissions.deny ではなく PreToolUse hook で止める](../20-PreToolUse/deny-by-hook-not-permissions.md)。permissions が複合コマンドを止められない根拠
- [hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒す](../20-PreToolUse/command-position-match-fails-closed.md)。8 KB 上限で打ち切りを避ける例
