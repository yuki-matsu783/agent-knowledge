---
type: pitfall
nature: finding
title: /btw の側の質問は transcript jsonl に 1 行も残らなかった
description: >-
  Records that a Claude Code `/btw` side question and its answer leave no line in the session
  transcript jsonl, so hooks and scripts that read the transcript cannot see them at all. Use when
  counting turns or token usage from the transcript, when a Stop hook reviews the session, or when
  deciding whether to ask something with `/btw` or with a subagent. Not for `/compact` or `/clear`,
  which do change what the transcript holds, and not for subagent transcripts, which are separate
  files that do get written.
tags: [claude-code, observability, context-management]
keywords: [/btw, side question, 側の質問, 脱線, transcript, jsonl, 会話履歴に入らない, オーバーレイ, パネル, VS Code 拡張, Stop hook, ターン数, 使用量, fork, サブエージェント, 記録が無い, ツールが無い, skill が起動しない, slash command]
status: stable
verified_at: 2026-09-06
stale_after: 2027-03-06
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/interactive-mode
  - https://code.claude.com/docs/en/commands
---

# /btw の側の質問は transcript jsonl に 1 行も残らなかった

## 症状

`/btw` で聞いた質問とその回答が、transcript jsonl を読む道具からまったく見えない。行が欠けているのではなく、最初から書かれていない。

VS Code 拡張 2.1.261 のチャットパネルで `/btw` を使った直後、そのセッションの transcript を読んでも `type: "user"` の行は本筋の 2 件だけで、側の質問の行は無かった。
`~/.claude/projects` 配下 11 プロジェクト分の jsonl を横断して探しても、側の質問として記録された行は 1 件も出てこない。

```sh
grep -rl '"/btw' ~/.claude/projects --include='*.jsonl'
```

引っかかるのは本文に `/btw` という文字列を含む会話 (記事の引用や説明) だけで、側の質問そのものの行ではない。

## 原因

公式ドキュメントは側の質問について "The question and answer never enter the conversation history" と書いている。
会話履歴に入らないというのは「次のリクエストで送られない」だけの話ではなく、**履歴を書き出す transcript にも行が増えない**ということ。
側の質問は会話のコピーを読むだけで、会話に何も書き戻さない。

保持先も transcript とは別になっている。ターミナルの CLI はオーバーレイをメモリに持ち、`x` で消え、終了すれば消える。
VS Code 拡張はパネルのスレッドとして持ち、ウィンドウの再読み込みをまたいで残る。どちらも jsonl ではない。

## 回避策

- **transcript からターン数や使用量を数える道具は、側の質問を数えない。** 数え漏れを疑う前に「そもそも記録が無い」ことを前提にする。[transcript の行種別](transcript-line-types-and-what-writes-them.md) に側の質問は現れない
- **Stop hook で最終報告をレビューさせる仕組みからも見えない。** [Stop hook のレビュー](../hooks/11-Stop/haiku-prompt-hook-reviews-final-report-on-second-stop.md) は transcript の本筋しか読まないので、側の質問で決めたことは審査の対象にならない。決定を含むやり取りは `/btw` でやらない
- **記録に残したいなら側の質問から出す。** オーバーレイの `f` でサブエージェントにフォークすれば、そのサブエージェントは[自分の transcript ファイル](subagent-transcript-is-separate-file-with-every-tool-call.md)を持つ (フォーク後の記録の中身までは未確認)
- **逆に、残したくないものは意図的に逃がせる。** 本筋に入れたくない確認は `/btw` に寄せると、会話履歴もコンテキストも伸びない。側の質問はツールを持たず、すでにコンテキストにあるものからしか答えられないので、新しく調べさせたいならサブエージェントを使う
- **側の質問に skill / slash command を書いても実行されない。** 側の質問に `/commit` と書いたところ、skill は起動せず「ツールが無いのでコミットできない、メインの流れで送り直せ」という文章が返ってきた。読み取りも含めてツールが一切動かないので、`/btw` は「今のコンテキストから答えられること」専用の窓口になる。ただし会話は全部見えているので、セッション開始時の `git status` の中身を側の質問から要約させることはできた

## 再現条件

- VS Code 拡張 2.1.261 (Windows 10、Git Bash)。CLI は 2.1.235 が入っているが、CLI のオーバーレイでは試していない
- パネル形式の `/btw` は拡張 2.1.227 以降。それより前の拡張には `/btw` が無い
- 確かめていないこと 2 点。(1) `UserPromptSubmit` と `Stop` の hook が側の質問で発火するかどうか。手元に `UserPromptSubmit` hook を登録していないため観測できていない。(2) CLI のオーバーレイでも同じく transcript に残らないかどうか

## 関連

- [transcript の行種別と書き手](transcript-line-types-and-what-writes-them.md)
- [サブエージェントの transcript は別ファイル](subagent-transcript-is-separate-file-with-every-tool-call.md)
- [compact は送信される会話を要約で組み直す](compact-rebuilds-the-sent-conversation-as-a-summary.md)
