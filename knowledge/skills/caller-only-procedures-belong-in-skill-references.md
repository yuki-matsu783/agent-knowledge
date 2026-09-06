---
type: pattern
nature: best-practice
title: 他の skill からしか呼ばれない手順は skill にせず references のファイルに置くべき
description: >-
  Says that a procedure only ever reached from inside another skill should live as a bundled
  reference file the parent SKILL.md links to, not as a second registered skill. A second skill
  costs twice: its description sits in the per-turn skill listing forever although nothing needs to
  discover it, crowding the least-invoked skills out of the shared 1% budget, and the parent's
  "now use skill X" line is a probabilistic tool call while a markdown link is just a read. Use when
  splitting a SKILL.md that grew past 500 lines, or when deciding whether a shared step deserves
  its own skill. Not for procedures a user or Claude may trigger directly, and not for steps that
  must run reliably, which belong in a hook or a script instead.
tags: [claude-code, context-management, prompting]
keywords:
  - SKILL.md
  - references
  - reference.md
  - skill 分割
  - サブスキル
  - skill から skill
  - progressive disclosure
  - 一覧予算
  - skillListingBudgetFraction
  - 500 行
  - markdown リンク
  - 希薄化
status: stable
verified_at: 2026-09-06
stale_after: 2027-03-06
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/skills
intervention: tool
---

# 他の skill からしか呼ばれない手順は skill にせず references のファイルに置くべき

## 課題

SKILL.md が長くなったので分割したい。素直にやると 2 本目の skill を作り、親の SKILL.md に「終わったら X skill を使え」と書く。
これは 2 つ損をする。

- **一覧予算を食う。** skill の一覧 (名前と description) は毎ターン context に入る。2 本目は親から呼ばれるだけで自発的に起動される必要が無いのに、
  発見されるための description を毎ターン置き続ける。予算は context window の 1% の共有プールなので、
  この分は他の skill から取り上げたことになる
- **呼び出しが確率的になる。** 「次に X skill を使え」と書いても、Skill ツールを実際に呼ぶかはモデルの判断。
  親の手順の途中で止まると、そこから先が丸ごと抜ける

どちらも根は同じで、**発見される必要が無いものを発見のための場所に置いている**。

## 解決

**呼ばれ方で置き場所を決める。** 長さで決めない。

| その手順に辿り着く経路 | 置き場所 |
|---|---|
| ユーザの発話やモデルの判断で直接起動されうる | skill (SKILL.md) |
| 親 skill の手順の途中でしか使わない | 親 skill の中のファイル (`references/*.md` など) |

公式の推奨レイアウトがそのまま使える。SKILL.md を 500 行以内に保ち、詳細は別ファイルに移し、
SKILL.md から markdown リンクで「何が書いてあるファイルか、いつ読むか」を添えて指す。
リンク先は Claude が必要と判断したときだけ読み込まれるので、読まれるまでのトークンはほぼゼロになる。

このリポジトリに入れてある archify skill がこの形で、`references/` に 4 本置き、SKILL.md 側で
「ユーザが訊いてこない限り viewer runtime の reference は読むな」のように条件を添えている。

## 適用条件

- **2 つ以上の skill が共有する手順**は判断が割れる。3 本目の skill を作るより、knowledge か `.claude/docs/` に 1 ファイル置いて
  両方の SKILL.md から相対リンクする方が安い。一覧予算を 1 つも使わない
- **独立して起動されうるなら skill にする。**「コミットして」と言われて動く必要があるなら commit skill は要る。
  親からしか呼ばれないという条件が崩れたら、このパターンは当てはまらない
- 手順が「必ず実行される」ことを保証したいなら、references でも skill でもなく hook かスクリプトに移す。
  参照は読み飛ばされうるので、[文言ではなく機構で穴を塞ぐ](../rules/close-gaps-with-mechanism-not-wording.md)

## トレードオフ

- references は**読ませ忘れが起きる**。skill 呼び出しより軽い代わりに、強制力も無い。SKILL.md 側に読む条件を書いて補う
- 分割しすぎるとファイルを跨ぐ往復が増える。読ませるファイルは 1 手順あたり 1 本に収める
- `/<name>` で人が直接叩ける入口が減る。デバッグのために単体で走らせたい手順は skill のままにしておく方が楽なことがある

## 関連

- [skill の description は 1,536 字で切られ一覧が予算を超えると使っていない skill は名前だけになる](skill-description-cut-by-listing-budget.md)。一覧予算の仕組み
- [skill を足すコストは既存の skill が払うので総数を絞るべき](adding-a-skill-is-paid-by-the-other-skills.md)。同じ予算を総数の側から見たもの
- [skill が増えたら一覧の切り詰めではなく MCP と同じ検索ツールに寄せられるはず (未検証)](skill-search-tool-instead-of-listing-truncation.md)。予算そのものを広げる設計案
- [context に入るものと入るタイミング](../diagrams/what-enters-context-when.dataflow.html)。skill の一覧と本体が context に入る経路 (ブラウザで開く)
- [context が伸びるほど指示が効かなくなるのは注意が全トークンに配られるから](../model/attention-dilutes-as-context-grows.md)。一覧予算を含む常駐トークンの話がなぜ効くかの根
