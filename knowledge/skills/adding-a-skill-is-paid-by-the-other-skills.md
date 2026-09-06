---
type: pattern
nature: best-practice
title: skill を足すコストは既存の skill が払うので総数を絞るべき
description: >-
  States that the Claude Code skill listing is a fixed shared pool, so each skill added is paid for
  by the existing skills rather than by the new one: when the listing overflows its 1% context
  budget, Claude Code drops the descriptions of the least-invoked skills, and the author never
  notices because the skill they just wrote is the one they keep invoking. Gives the checks to run
  before adding one, and separates the per-turn listing budget from the resident cost of a skill's
  body after invocation, since only the first scales with the number of skills. Use when tempted to
  turn every repeated procedure into a skill, when installing plugins, or when a skill that used to
  fire on its own stopped firing. Not for how one skill's description should be worded, and not for
  where a caller-only procedure should live.
tags: [claude-code, context-management, cost]
keywords:
  - skill 総数
  - 作りすぎ
  - 一覧予算
  - skillListingBudgetFraction
  - skillListingMaxDescChars
  - /skill-doctor
  - /doctor
  - プラグイン
  - 呼ばれなくなった
  - 希薄化
  - context 圧迫
  - 共有プール
  - 外部不経済
status: stable
verified_at: 2026-09-06
stale_after: 2027-03-06
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/skills
  - https://code.claude.com/docs/en/settings-reference
intervention: tool
---

# skill を足すコストは既存の skill が払うので総数を絞るべき

## 課題

繰り返す手順を見つけるたびに skill にする。便利そうなプラグインを入れる。1 本ずつは小さいので、増やすことに歯止めがかからない。
しばらくすると、以前は自発的に呼ばれていた skill が呼ばれなくなる。

**足した人はこれに気付けない。** Claude Code は一覧が予算を超えると呼び出し回数の少ない skill から description を落とすので、
消えるのは常に「今使っていない skill」の側になる。作った本人は自分の新しい skill を使うから、それは落ちない。
つまり skill を 1 本足すコストを払うのは、その skill ではなく一番使っていない既存の skill になる。

## 解決

**skill を足す前に、毎ターンの context を何文字使ってよいかで判断する。** 便利かどうかで判断しない。

1. **既存 skill の分岐で足りないか。** 入口が同じで途中が 2 通りに割れるだけなら、1 本の中の分岐で済む。
   入口が違うときだけ別の skill にする
2. **発見される必要があるか。** 他の skill からしか呼ばれないなら skill にしない
   ([他の skill からしか呼ばれない手順は references に置く](caller-only-procedures-belong-in-skill-references.md))
3. **プラグインは使うものだけ入れる。** 予算の大半をプラグイン由来の skill が食っていることが多い。
   1 本の skill のために 10 本入るプラグインは、9 本分の description を他から取り上げている
4. **数を測る。** `/doctor` で一覧のコスト、`/skill-doctor` (v2.1.252 以降) で使われていない skill が分かる。
   増やしたら測る、を回す

## 適用条件

**予算は 2 つあり、総数が効くのは一覧の方だけ。**

| 予算 | いつ context に入るか | 何に比例するか |
|---|---|---|
| skill の一覧 (名前 + description) | 毎ターン、全 skill 分 | **skill の本数** |
| skill の本体 (SKILL.md と読ませたファイル) | 起動したときだけ。以降は compact まで残る | 起動した skill の長さ |

絞るべきなのは本数であって、1 本の長さではない。長い skill が 1 本あることより、使わない skill が 20 本あることの方が効く。
逆に、起動後にずっと残る本体のコストは本数と無関係なので、ここは「短く書く」で別に対処する。

## トレードオフ

- 1 本に詰め込むと SKILL.md が長くなり、起動後の常駐コストが上がる。詰め込む先は本体ではなく参照ファイルにする
- 手順を skill にしないと、`/<name>` で人が直接叩ける入口が減る。運用でよく使うものは残す
- `skillListingBudgetFraction` を上げれば一覧は入るが、上げた分だけ毎ターンの context が減る。
  どちらを選んでも context は希薄になるので、本数を減らす以外に得をする手は無い

## 関連

- [skill の description は 1,536 字で切られ一覧が予算を超えると使っていない skill は名前だけになる](skill-description-cut-by-listing-budget.md)。落とされ方の詳細
- [他の skill からしか呼ばれない手順は skill にせず references のファイルに置くべき](caller-only-procedures-belong-in-skill-references.md)。本数を増やさずに分割する置き方
- [skill が増えたら一覧の切り詰めではなく MCP と同じ検索ツールに寄せられるはず (未検証)](skill-search-tool-instead-of-listing-truncation.md)。本数を絞らずに済ませる設計案
- [CLAUDE.md は最小から始めモデルが外したときだけ足すのがよいはず (未検証)](../rules/claude-md-starts-minimal-and-grows-only-on-misses.md)。同じ「足す前に止まる」を rules 側で言ったもの
- [context が伸びるほど指示が効かなくなるのは注意が全トークンに配られるから](../model/attention-dilutes-as-context-grows.md)。一覧予算を含む常駐トークンの話がなぜ効くかの根
