---
type: note
nature: opinion
title: CLAUDE.md は最小から始めモデルが外したときだけ足すのがよいはず (未検証)
description: >-
  Collects practitioner advice on how big CLAUDE.md and always-loaded rules should be for Claude
  Code: frontier models follow only about 150-200 instructions reliably, so every line in CLAUDE.md,
  rules, tool definitions, and the skill being run competes for one budget (Dex Horthy); add a rule
  only after Claude actually made the mistake and edit ruthlessly until the mistake rate drops, in
  one file shared through git (Boris Cherny); and rules that compensate for today's model become
  dead weight when the model changes ("build for the model six months out"). Use when CLAUDE.md or
  .claude/rules keeps growing, or when a long skill is skipped mid-run. Not a measured threshold for
  this repository, and not about the lazy-loading mechanics of paths: rules.
tags: [claude-code, prompting, context-management]
keywords:
  - CLAUDE.md
  - .claude/rules
  - 指示予算
  - instruction budget
  - 150〜200 指示
  - 常時読み込み
  - 短く保つ
  - 失敗してから足す
  - 削る
  - モデル更新
  - 6 か月先のモデル
  - 足場
  - 規約の肥大化
  - 遵守率
status: stable
sources:
  - https://youtu.be/YwZR6tc7qYg?t=455
  - https://x.com/bcherny/status/2017742747067945390
  - https://x.com/bcherny/status/2007179840848597422
  - https://youtu.be/PQU9o_5rHC4?t=1
---

# CLAUDE.md は最小から始めモデルが外したときだけ足すのがよいはず (未検証)

## 主張の元

3 つの発言を組み合わせている。どれも自分では測っていない。

- **指示には予算がある** (Dex Horthy、HumanLayer、2026-03 の講演)。引用している論文の値で、フロンティアモデルが一貫して従える指示は約 150〜200 件。超えると「全部に半分ずつ注意を払ってサイコロを振る」状態になる。
  85 件の指示を持つプロンプトに CLAUDE.md、システムプロンプト、ツール定義、MCP が乗れば、手順の完全な遵守は望めない、と自分たちの RPI ワークフローで手順が飛ばされた原因を説明している
- **足すのは間違えた後、削るのは常に** (Boris Cherny、Claude Code 作者、2026-02 の tips)。訂正のたびに「二度と間違えないよう CLAUDE.md を更新して」と締め、ミス率が測って下がるまで容赦なく編集する。
  1 つの CLAUDE.md を git に入れてチーム全員が週に何度も足す。同僚の PR に `@claude` を付けて CLAUDE.md への追記を PR の一部にする
- **6 か月先のモデルに向けて作る** (Boris、2026-02)。今のモデルの弱点を補う足場は次のモデルで不要になる。CLAUDE.md の規約にも同じことが言え、モデルが変わったら「まだ間違えるか」から見直す

## このリポジトリへの当てはめ

CLAUDE.md と `paths` の無い `.claude/rules/*.md` は毎セッション読み込まれ、そこに skill の手順、ツール定義、hook の説明が乗る。
予算が 150〜200 件なら、常時読み込みの規約が 100 件を超えた時点で、その上で走る skill の手順が飛ぶ側に回る。
[compact 後に 1,100 行の SKILL.md の手順が飛ぶ](../hooks/00-SessionStart/reread-instruction-not-content-after-compact.md) のは、
読み直しで直る問題とも読めるし、予算超過の症状とも読める。後者なら読み直しは対症療法で、手順を分割して短くする方が先。

やるとすれば次の順。

1. CLAUDE.md と常時読み込みの rules の命令文を数える (「〜する」「〜しない」の行)。skill と hook の分も足す
2. 「一度も間違えていない規約」を消す候補にする。守られているのが規約のおかげか、モデルが元から間違えないのか分からないものは消して様子を見る
3. 守らせたいが文言で守れないものは [文言ではなく機構で穴を塞ぐ](close-gaps-with-mechanism-not-wording.md)。lint と hook に移した規約は CLAUDE.md から消せる
4. 特定のファイルにしか関係しない規約は `paths` 付きの rules に移し、常時読み込みから外す
5. モデルを変えたら 2 をやり直す

skill の description にも同じ圧力が掛かる ([description は 1,536 字で切られる](../skills/skill-description-cut-by-listing-budget.md))。

## 確かめていないこと

- このリポジトリの常時読み込みの指示が何件あるか。数えていない
- 規約を減らして遵守率が上がるか。Boris の言う「ミス率が測って下がる」の測り方をこのリポジトリで決めていない
- 150〜200 という値がどのモデルの話か。Dex 自身が「去年の論文なので今はもう少し高い」と言っている
- 「モデルが変わったら足場を消す」を実際にやって何が消せたか

## 昇格の目安

- [ ] 粒度が `pattern` に収まっている (課題「規約が増えて手順が飛ぶ」と解決「最小から始めて失敗時に足す」)
- [ ] sources に一次情報がある (論文の URL と Anthropic の公式文書が要る。今は実践者の発言のみ)
- [ ] 実際に数えて減らし、applies_to と verified_at を書ける
