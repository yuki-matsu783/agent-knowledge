---
type: pattern
title: compact 後に SessionStart hook で作業コンテキストを再注入する
description: >-
  A Claude Code hook pattern that adds `compact` to the SessionStart matcher so the same script that seeds
  context on startup/resume/clear also runs after every manual or automatic compaction, injecting only the
  short "where am I" facts (branch, issue, PR, the next-steps section of a handoff file, names of branch-specific
  work files) rather than whole documents, and appending a warning instead of truncating when the payload
  exceeds a byte threshold. Use when an agent resumes after /compact with the wrong idea of what it was doing,
  or when PreCompact turns out not to support additionalContext. Not for Gemini CLI, which has no post-compress
  hook, and not for asking the user to compact at a task boundary, which is a separate pattern.
tags: [claude-code, context-management, workflow]
keywords: [compact, SessionStart, matcher, additionalContext, PreCompact, 再注入, 現在地, HANDOFF, 次にやること, しきい値, 8000 バイト, 切り詰めない, fork, 起動要因, hookSpecificOutput]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# compact 後に SessionStart hook で作業コンテキストを再注入する

## 課題

`/compact` (自動・手動) は会話履歴を要約するが、何を残すかは指定できない。作業継続に要る「現在地」
(どのブランチで何をしているか、issue / PR は何番か、次に何をするか) が要約の精度次第で落ち、compact 直後のエージェントが
誤った前提で再開する。`PreCompact` hook は compact の直前に発火するが `additionalContext` を受け付けず、標準出力も
コンテキストへ注入されないので、この用途には使えない。

## 解決

SessionStart hook の matcher に `compact` を加え、起動時と同じスクリプトで現在地を注入する。

```json
{ "hooks": { "SessionStart": [ { "matcher": "startup|resume|clear|compact", "hooks": [ { "type": "command", "command": "bash .claude/hooks/session-start.sh" } ] } ] } }
```

注入するものを設計時に絞る。ファイルの中身は原則注入しない。

| 対象 | 注入する | 注入しない |
|---|---|---|
| ブランチ / issue / PR / 未解決レビュー件数 | すべて | |
| 引き継ぎファイル (HANDOFF.md 相当) | 「次にやること」節だけ (見出しから次の `## ` の手前まで) | 進捗表、やったこと、迷った内容 |
| ブランチ固有の作業ファイル (plans / worklog / reports) | ファイル名の一覧 | 中身 |

「次にやること」だけを採るのは、compact 後に即座に必要で、かつ短い唯一の節だから。履歴は必要になった時点でエージェントが読めばよい。
実測の注入量は約 1.2KB で、引き継ぎファイル全文 (十数 KB) を毎セッション・毎 compact で払うのは過大。

注入量がしきい値 (既定 8000 バイト、環境変数で上書き) を超えたら、**切り詰めずに警告文を末尾へ足す**。判定はバイト数で行う
(日本語は UTF-8 で 1 文字 3 バイトなので文字数だと 3 倍ずれる)。切り詰めると守ろうとしている情報そのものを失い、
しかも失ったことがエージェントから分からないので、部分的な情報を完全なものと誤認する。膨らむ原因は人間が管理できるファイルなので、
整理を促す方が根本的。

**起動要因で注入内容を分岐させない。** compact 専用の別スクリプトや、compact のときだけ多く注入する設計は、hook の出力が
起動経路に依存して検証すべき組み合わせが増える。startup で 1 回余分に読む程度の節約に見合わない。

## 適用条件

- 効く: 長いセッションで自動 compact が起きる作業、引き継ぎファイルを運用しているリポジトリ
- `fork` は対象にしない。fork 時は親のコンテキストがそのまま引き継がれ、要約による欠落が起きない
- 注入に `gh` 等の API 呼び出しを伴う場合、compact のたびに走るコストが理由で除外されがちだが、compact の頻度 (autoCompactWindow 600000 程度) では
  数回の呼び出しに過ぎず、現在地を失うコストの方が大きい

## トレードオフ

- 得る: compact 直後でも同じ前提で作業が続く。誰かが `resume` を呼んでくれる保証が無い場面でも成り立つ
- 失う: compact のたびに hook が走る。注入内容が「現在地」に限られるので、手順そのものを失った場合は別途読み直させる必要がある
  ([reread-instruction-not-content-after-compact.md](reread-instruction-not-content-after-compact.md))

## 関連

- [compact 後は「読んだ」認識を信用せず手順書の読み直しを指示で注入する](reread-instruction-not-content-after-compact.md)
- [タスクの切れ目で /compact と /clear をユーザに依頼させる](ask-user-to-reset-context-at-task-boundaries.md)。境界で compact させる側。こちらは compact 後の回復側
- [Gemini CLI には圧縮後に発火する hook が無い](gemini-cli-no-post-compress-hook.md)。同じことを Gemini CLI でやろうとしたときの制約
- [Claude Code の transcript JSONL は /compact を挟んでも追記専用である](transcript-jsonl-is-append-only-across-compact.md)
