---
type: pattern
nature: heuristic
title: compact 後は「読んだ」認識を信用せず手順書の読み直しを指示で注入した方がよさそう
description: >-
  A Claude Code pattern for long procedure documents (a 1,000-line SKILL.md that defines the whole workflow):
  after compaction the agent still "remembers" having read the file but has lost the details, so a SessionStart
  hook appends a short instruction to re-read the file even if it was already read this session, with the path,
  the reason, and what breaks if the procedure is lost, instead of injecting the document itself or a summary of
  it. Use when an agent skips steps of a documented flow after /compact, or when a hook already re-injects
  "where am I" but not "how do I work". Not for short rules that fit in CLAUDE.md, which Claude Code re-injects
  from disk after compaction anyway, and not for skills that fit inside the 5,000-token per-skill re-injection
  cap, where nothing is lost and no hook is needed.
tags: [claude-code, context-management, prompting]
keywords: [compact, SKILL.md, 読み直し, 再読み込み, 注入, additionalContext, SessionStart, 要約, 手順の喪失, 再注入の上限, 5000 トークン, CLAUDE.md は再注入される, 判定根拠, ブランチ判定, 二重管理]
status: stable
verified_at: 2026-09-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/context-window
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: hook
---

# compact 後は「読んだ」認識を信用せず手順書の読み直しを指示で注入する

## 課題

作業手順を 1 本の長い SKILL.md (1,100 行超) で定義していると、compact 後にその手順理解が失われ、レビュー往復や
コミット経路の強制、進捗更新といった手順を踏み外す。Claude Code は呼び出し済み skill の本文を compact 後に再注入するが、
上限が 1 件 5,000 トークン、合計 25,000 トークンで、超えた分は先頭を残して切り詰められる (公式の context-window ページ)。
1,100 行の SKILL.md はこの cap を超えるので、後半の手順だけが静かに落ちる。「現在地」を再注入する仕組み
([reinject-work-context-after-compact.md](reinject-work-context-after-compact.md)) があっても、手順を失っていれば同じ事故が起きる。

この失敗はエージェント側から見えない。SKILL.md を読んだ事実は会話履歴に残るので、要約後のエージェントは「もう読んだ」と認識したまま、
細部を失った理解で進める。

## 解決

SessionStart hook が組み立てる注入テキストの**末尾**に、次の内容の短い節を足す。

- 読み直す対象のパス
- **「このセッションで既に読んでいる場合も読み直すこと」**。要約後は「もう読んだ」という認識自体が信用できないので、これが要点
- なぜ読み直すのか (compact で手順が失われうる) と、失われると何を踏み外すのかを 1 文
- 「なぜこのブランチが対象と判定されたか」の根拠 (例: ブランチ名が issue 命名規則に一致)。誤判定のときに原因が一目で分かる

末尾に置くのは、これが「作業を再開する前にすること」であり、compact 直後のエージェントの目に最後の行が留まりやすいため。
起動要因 (startup / resume / clear / compact) で分岐させない。compact 以外でも読み直させて困ることは無い。

対象ブランチの判定は、hook から追加コスト無しに得られる材料 2 つ (ブランチ名から issue 番号を抽出できる、ブランチ固有の作業ファイルがある) の
いずれかが成り立てば対象とする。対象外なら何も足さない。

## 適用条件

- 効く: 唯一のフロー定義が長い文書で、compact が日常的に起きる作業
- 効かない: 短い規約。CLAUDE.md や rules に書けば足りるし、それらは compact 後にディスクから再注入されるので失われない。
  cap に収まる短い skill も同じで、hook は要らない
- CLAUDE.md に「compact 後は SKILL.md を読み直せ」と書く案も成り立つ (CLAUDE.md 自体は残る)。hook を選ぶ理由は、compact 直後というタイミングに
  末尾で 1 回だけ出せることと、対象ブランチの判定根拠を添えられること。CLAUDE.md の「When compacting, preserve ...」は要約の焦点を変えるだけで、
  cap を超える本文を残す手段にはならない

## トレードオフ

- 得る: 手順の喪失を、エージェントが自覚できない状態のまま進ませない。指示文は 600〜700 バイトで有界
- 失う: 毎セッション・毎 compact で 1,100 行を読み直す時間。それでも、中身や要約を注入する案より安い。
  SKILL.md 側で打てる手は、公式の助言どおり重要な手順を先頭に寄せること (切り詰めは先頭を残す)
- 却下した案: SKILL.md の要約を注入する。注入用の要約を本体と二重管理することになり、ずれたときに**誤った手順を正史として注入する**という、
  何もしないより悪い状態を作る

## 関連

- [compact 後に SessionStart hook で作業コンテキストを再注入する](reinject-work-context-after-compact.md)。「現在地」の再注入。こちらは「手順」
- [タスクの切れ目で /compact と /clear をユーザに依頼させる](../22-PostToolUse/ask-user-to-reset-context-at-task-boundaries.md)
