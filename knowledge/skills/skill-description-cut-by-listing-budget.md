---
type: pitfall
nature: fact
title: skill の description は 1,536 字で切られ一覧が予算を超えると使っていない skill は名前だけになる
description: >-
  Explains why Claude Code stops invoking a skill on its own even though its description says when
  to use it: the per-turn skill listing is capped at a share of the context window
  (skillListingBudgetFraction, default 1%), each entry's description plus when_to_use is cut at
  skillListingMaxDescChars (default 1,536), and when the listing overflows Claude Code drops the
  descriptions of the least-invoked skills so only their names remain. Includes the measured
  description lengths of this repository's skills, four of six over the cap. Use when a skill is
  ignored, when writing long What / Use when / Not for descriptions, or when many plugins add skills.
  Not for skills that fail after being invoked, and not for the separate 5,000-token re-injection
  limit after compaction.
tags: [claude-code, prompting, context-management]
keywords:
  - skill
  - description
  - when_to_use
  - skillListingMaxDescChars
  - skillListingBudgetFraction
  - SLASH_COMMAND_TOOL_CHAR_BUDGET
  - "1536"
  - 1%
  - skill listing
  - 切り詰め
  - 名前だけ
  - 呼ばれない
  - /doctor
  - /skill-doctor
  - Not for
  - トリガー
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/skills
  - https://code.claude.com/docs/en/settings-reference
---

# skill の description は 1,536 字で切られ一覧が予算を超えると使っていない skill は名前だけになる

## 症状

description に「Use when ...」を丁寧に書いた skill が、その状況になっても自発的に呼ばれない。`/<name>` と打てば動く。
skill やプラグインを増やした頃から、以前は呼ばれていた skill が呼ばれなくなる。

## 原因

Claude Code はターンごとに skill の一覧 (名前と description と `when_to_use`) をコンテキストに入れるが、これに 2 段の上限がある (公式 skills ページ「Skill descriptions are cut short」)。

| 上限 | 既定 | 設定キー |
|---|---|---|
| 1 skill あたりの description + `when_to_use` の文字数 | 1,536 文字。超えた分は切られる | `skillListingMaxDescChars` |
| 一覧全体 | コンテキストウィンドウの 1% 相当 | `skillListingBudgetFraction` (例 `0.02`)、または `SLASH_COMMAND_TOOL_CHAR_BUDGET` に固定文字数 |

一覧が全体の予算を超えると、**呼び出し回数の少ない skill から description を落とし名前だけにする**。名前は必ず残るので `/<name>` は効くが、Claude が自分で選ぶ材料が消える。
description の末尾に置きがちな「Not for ...」は 1,536 字の切り詰めで真っ先に消える部分でもある。

このリポジトリの skill (2026-09-05、`description:` ブロックの文字数を数えた) は次のとおりで、6 本中 4 本が 1,536 字を超えていた。

| skill | 文字数 |
|---|---|
| commit | 約 6,200 |
| knowledge-add | 約 5,200 |
| slide-make | 約 2,900 |
| knowledge-audit | 約 2,500 |
| xlsx | 約 1,000 |
| archify | 約 700 |

## 回避策

1. **一番大事な使いどころを description の先頭に置く。** 公式の助言そのもの。What → Use when → Not for の順は、切られても前から残る
2. **1,536 字に収める。** 手順や規約の説明は description ではなく本文に置く。description は「今この skill を開くべきか」を判定させる文だけにする
3. **上限を上げるのは最後。** `skillListingMaxDescChars` と `skillListingBudgetFraction` は Any file scope なのでプロジェクト settings で上げられるが、毎ターンのコンテキストがその分減る
4. **使っていない skill を切る。** `/doctor` で一覧のコスト、`/skill-doctor` (v2.1.252 以降) で使われていない skill が分かる。プラグイン由来の skill が予算を食っていることが多い
5. ガードとして効かせたい規約は description に頼らない。[文言ではなく機構で穴を塞ぐ](../rules/close-gaps-with-mechanism-not-wording.md)

## 再現条件

上限の値と落とし方は公式 skills ページと settings-reference (2026-09 時点) の記述による。このリポジトリでは skill の description の長さだけを測り、
実際にどの skill の description が落ちているかは (システムプロンプトを直接見られないため) `/doctor` で確かめていない。予算の「1%」が文字数換算でいくつになるかも未確認。

## 関連

- [compact 後は「読んだ」認識を信用せず手順書の読み直しを指示で注入する](../hooks/00-SessionStart/reread-instruction-not-content-after-compact.md)。こちらは compact 後の再注入の 5,000 トークン上限で、別の上限
- [ツール定義の description は 1 行しか見えない](../workflow/tool-description-shows-one-line.md)。ツール側の同じ形の制約
