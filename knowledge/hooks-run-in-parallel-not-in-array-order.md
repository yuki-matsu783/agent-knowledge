---
type: pitfall
title: 同じイベントの hook は並列に走り settings.json の配列順は実行順ではない
description: >-
  Explains that every Claude Code hook matching an event starts at the same time ("All matching hooks
  run in parallel"), so the order of entries in settings.json is only a position, and designs that
  assume "the earlier hook already rejected this" or "the earlier hook already recorded the state"
  silently break: multiple denials can fire at once with no defined winner, a guard cannot skip work
  because a cheaper guard ran first, a shared library that reads a state file another hook writes
  races, and every fork in one hook is multiplied by the number of hooks on that event. Use when
  writing more than one hook for the same event, when a hook's denial message refers to another hook,
  or when a PostToolUse report appears only sometimes. Not for ordering across different events, which
  is fixed by the event sequence itself.
tags: [claude-code, security, observability]
keywords: [hook, 並列実行, run in parallel, 実行順, 配列順, 位置, settings.json, 複数 deny, 拒否理由, レース, PostToolUse, 状態ファイル, fork 倍増, ホットパス]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
---

# 同じイベントの hook は並列に走り settings.json の配列順は実行順ではない

## 症状

同じイベントに複数の hook を登録した仕様書が、配列の順を「実行順」と読んで次を前提にしていた。

- 「1 つでも deny を返せば拒否される。先に拒否した hook が理由を返す。安価で範囲の広い判定を先、高価で狭い判定を後に並べる」
- 各 hook の呼出条件に「state-guard の後、block-direct-git の前」「最後に実行」
- push 検知の共有ライブラリが状態ファイル (前回 push の SHA) を読み、案内側 hook の 1 本がそれを更新する

実際には push 成功時の工数レポートが**出たり出なかったり**した。レポート名の連番もずれた。

## 原因

公式リファレンスの一文に尽きる。

> All matching hooks run in parallel. If you define the same handler in more than one settings file, it runs once.

同じイベントに一致する hook はすべて同時に起動する。配列順は `settings.json` 上の位置であって実行順ではない。だから

- 「先に走る hook が弾くから、こちらは判定を省ける」という最適化は成立しない。全 hook が全入力を判定する
- 複数の hook が同時に deny を返し得る。どの理由が AI に見えるかは不定
- 「entry hook を通っているので宣言はある」のように、他の hook が先に判定した前提を拒否理由に書けない
- 状態ファイルを書く hook と読む hook が同じイベントにいると、どちらが先かは毎回変わる (レース)。レポートが「時々出る」のはこれ
- 5 本の hook がそれぞれ 1 回 fork すれば、毎ツール呼び出しで 5 プロセスが同時に起きる。1 本の fork の増加はそのまま本数倍になる

PostToolUse はさらに、Claude が並列にツールを呼ぶと同時に発火する (公式: "fires concurrently when Claude makes parallel tool calls")。
同じファイルへの書き込みが競合する場面はイベント内の並列だけではない。

## 回避策

- `settings.json` の並びは「位置」として管理し、テストで照合するのは位置まで。実行順の意味づけを仕様から消す
- 各 hook の拒否理由は**単独で読んで成立する文面**にする。他の hook の判定結果に言及しない
- 順序による絞り込みは無いので、性能は「各 hook が単独で軽いこと」だけで決まる。fork の回数を hook ごとに数えて上限を置く
- 共有ライブラリは状態ファイルを持たず、進捗の起点 (前回どこまで進んだか) は呼び手が引数で渡す。呼び手ごとに別の状態を持てば、どの順で走っても互いに影響しない
- 記録ファイルへの並行書き込みは [並行する hook の記録は追記の行長制限と一時ファイルと mkdir ロックで守る](concurrent-hook-writes-append-tmpfile-mkdir-lock.md) の 3 段で守る
- 11 本を 1 本にまとめて内部で順に判定する案は、緊急停止やテストの粒度、要件との対応が崩れるので採らない

## 再現条件

公式 hooks リファレンス (2026-09 時点) の記述による。レースの実例は bash + jq の hook 11 本を PreToolUse と PostToolUse に分けて登録した構成で観測された。

## 関連

- [並行する hook の記録は追記の行長制限と一時ファイルと mkdir ロックで守る](concurrent-hook-writes-append-tmpfile-mkdir-lock.md)。並列が引き起こす書き込み競合の対策
- [ホットパスの hook は秒数ではなく fork の回数で予算を決める](count-forks-not-seconds-for-hot-path-hooks.md)。本数倍になる fork の抑え方
- [共有ライブラリは分類までにし規約との照合は呼び手が行う](shared-library-classifies-caller-matches-rules.md)。ライブラリが状態を持たない理由
- [タイムアウトした hook はガードにならず素通りする](hook-timeout-fails-open.md)
