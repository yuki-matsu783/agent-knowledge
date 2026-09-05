---
type: note
nature: opinion
title: context が増えると質が落ち始める閾値は 40% から 400k トークンまで諸説ある (未検証)
description: >-
  Collects the thresholds practitioners give for when a coding agent's output quality drops as the
  context window fills ("context rot", "dumb zone"): around 300-400k tokens on Claude's 1M-context
  model (Thariq Shihipar, Anthropic), keep under 40% and wrap up by 60% for newcomers with
  instruction-heavy work (Dex Horthy, HumanLayer), and roughly the 100k range on a 200k window
  (Matt Pocock), plus the point that the ratio of instructions to information matters more than the
  raw count. Use when choosing a percentage for a statusline sensor, a compact reminder, or a task
  size. Not measured in this repository, and the numbers are opinions tied to specific models and
  months, not a rule.
tags: [context-management, claude-code, prompting]
keywords:
  - context rot
  - dumb zone
  - smart zone
  - 閾値
  - 40%
  - 60%
  - 100k
  - 300k
  - 400k
  - 1M context
  - 200k context
  - compact のタイミング
  - タスクの大きさ
  - 指示と情報の比率
  - 品質低下
  - used_percentage
status: stable
sources:
  - https://x.com/trq212/status/2033949937936085378
  - https://youtu.be/YwZR6tc7qYg
  - https://youtu.be/-QFHIoCo-Ko
  - https://code.claude.com/docs/en/env-vars
---

# context が増えると質が落ち始める閾値は 40% から 400k トークンまで諸説ある (未検証)

## 諸説

どれも「context が埋まるほど注意が薄まり、古い無関係な内容が邪魔をして質が落ちる」という同じ現象を指しているが、数字は揃わない。

| 誰が (いつ) | 対象 | 閾値 | 但し書き |
|---|---|---|---|
| Thariq Shihipar (Anthropic、2026-04 の tips) | Claude の 1M context モデル | 約 300〜400k トークンで context rot が起きる | 「タスクに強く依存する。速い規則ではない」 |
| Dex Horthy (HumanLayer、2026-03 の講演) | コーディングエージェント一般 | 初心者は 40% 未満に保ち、60% に達したら畳む | 慣れた人は 60% まで使うし、逆に 30% 未満に抑えることもある。**指示と情報の比率**で変わる |
| Matt Pocock (2026-04 のワークショップ) | 200k → 1M に広がった Claude Code | 「smart zone」に収まるようタスクを小さく切る。1M は検索向きでコーディング向きではない | 「dumb zone は最近まではっきりしなくなった」とも |

3 者に共通するのは数字ではなく次の 2 点。

- **閾値は使用率で決まらない。** 指示が多い (手順書、rules、ツール定義) ほど早く落ちる。情報 (読んだコード) が多いだけなら遅い
- **落ち始めてから直すより、落ちる前に切る。** compact よりタスクを小さく切る方が先で、compact は最後の手段

## 当てはめ

- [statusline を context 使用量のセンサーにする](../hooks/common/statusline-as-context-usage-sensor-for-hooks.md) の閾値は、20〜25% と 80% という別の実践値を引いている。上の表と合わせると「20〜40% で引き継ぎを書き始め、60〜80% で切る」あたりに幅が収まる。自分のタスクの指示の量で決める
- 落ちる前提で [失敗した手はチケットの Do-Not-Repeat 節に残す](../workflow/keep-do-not-repeat-list-outside-context.md) と [compact 後に手順書を読み直させる](../hooks/00-SessionStart/reread-instruction-not-content-after-compact.md) を組む
- Claude Code 自身の自動 compact の発火は品質ではなく残り容量で決まる。`CLAUDE_CODE_AUTO_COMPACT_WINDOW` (v2.1.213 以降) で発火位置を動かせるが、それでも上の閾値とは別の物差し

## 確かめていないこと

- このリポジトリの作業で、どの使用率から手順の踏み外しが増えるか。transcript の `usage` は[実際より少なく出る](../workflow/transcript-usage-tokens-undercount.md)ので、測るなら statusline の `used_percentage` で
- 指示の量を減らす (rules と SKILL.md を短くする) と閾値が上がるか
- モデルごとの差。表の 3 者はそれぞれ別のモデルと月の話をしている。`applies_to` に書けるのは自分で測ってから

## 昇格の目安

- [ ] 粒度が `concept` に収まっている (現象の説明としてなら 1 つ)
- [ ] sources に一次情報がある (実践者の発言のみ。Anthropic の公式文書か論文が要る)
- [ ] 実際に測って applies_to にモデル名と観測月、verified_at を書ける
