---
type: pattern
nature: best-practice
title: 通知しなかった判定も skip として記録し記録の欠如を縮退と読めるようにすべき
description: >-
  A pattern for hooks that fall back to a second checkpoint when the first one is unavailable: the
  primary hook records every decision branch, including the ones where it decided not to notify (with the
  reason: matched, no target, field missing, type out of scope), so that the fallback hook can treat "no
  record at all" as "the primary did not run" and judge for itself, instead of the impossible "re-display
  when there is no record" or the wrong "notify whenever no notification was recorded". Use when a
  PreToolUse path and a PostToolUse path back each other up, or when a fallback fires on every call. Not
  for what to notify about.
tags: [observability, claude-code]
keywords: [skip, notify, 記録, 縮退, 再掲, 記録の欠如, 判定していない, 通知不要, decisions.jsonl, agentId, フォールバック, PreToolUse, PostToolUse, 二重通知, 判定した事実]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
intervention: hook
---

# 通知しなかった判定も skip として記録し記録の欠如を縮退と読めるようにする

## 課題

サブエージェントの実行者 (モデル) が計画と違うことを通知する hook を、起動前 (PreToolUse `Agent`) を本線、起動後 (PostToolUse `Agent`) を縮退時の保険として 2 か所に置いた。
保険側の条件を「判定記録に本線の通知が**無い**ときだけ再掲する」と書いたところ、レビューで 3 つの矛盾が出た。

- **記録が無いなら再掲する元が無い。** 「再掲」は既にある記録を読み直して伝えることで、記録が無い状態では実行できない。実装者は記録を探し続けるか、勝手に判定を書くかのどちらかになる
- 縮退時に自分で判定するなら、その手順と入力 (`tool_input.model`、モデル別名表) が保険側の仕様に無い
- 「記録が無い」は 2 つの状態を区別できない。(a) 本線が判定していない (縮退)、(b) 本線が判定したが**通知不要と決めた** (一致していた等)。(b) で通知すると、一致しているのに不一致の通知が出る

## 解決

- **本線の hook は、通知しなかった場合も `skip` を理由付きで記録する。** 理由は 5 通り (一致 / 対象チケット無し / 実行者の記載無し / モデルを特定できない / 対象外の種別)。判定記録の既存の値なので新しい仕組みは要らない
- **縮退の判定は「同じ識別子について本線の記録が 1 件も無い」ときだけ。** `notify` があれば通知済み、`skip` があれば通知不要と判定済み、どちらも無ければ本線が動いていない
- **縮退時、保険側は「再掲」ではなく自分で判定する。** 同じツール呼び出しの `tool_input` が読めるので新しい入力は要らない。仕様の「再掲」という語を消す
- テストは 3 通りで固定する: 記録が無い → 出る / `skip` がある → 出ない / `notify` がある → 出ない

**判定した事実を残さないと、判定したかどうかが分からない。** 「記録の有無で縮退を見分ける」設計を採る以上、判定のすべての分岐が記録を残す必要がある。

副産物として、`skip` の理由は振り返りにも効く。「なぜ通知されなかったのか」(`model` が省略されていた等) が後から分かり、限界として書いた「モデル省略時は比較できない」が実際にどれだけ起きるかを測れる。

## 適用条件

- 効く: 本線と保険の 2 経路を持つ通知、記録の有無で分岐する hook 全般。縮退の原因が停止だけでなく登録漏れ・起動失敗・matcher 不一致にも及ぶとき (記録の有無ならすべて同じ形で拾える。環境変数で縮退を判定する案はこれらを拾えない)
- 効かない: 保険側が常に判定して本線の記録があれば黙る形。判定のコストは小さいので実質同じだが「誰が正か」が曖昧になる

## トレードオフ

- 得る: 二重通知と誤通知が消える。判定記録が「判定しなかった理由」の統計になる
- 失う: 判定記録の行数が増える (通知しない呼び出しにも 1 行)

## 関連

- [Agent ツール周りの hook 入出力の一覧](../agent/agent-tool-hook-fields-reference.md)。記録を引く識別子 (`tool_response.agentId`) が入力側の `agent_id` と別名で、取り違えると常に縮退になる
- [サブエージェントは既定で background で走り PostToolUse Agent は起動直後に発火する](../agent/subagent-runs-in-background-by-default.md)。保険側の経路が起動直後に来る話
- [縮退で拒否したときの理由文は本来の拒否と分けて何が判定を妨げたかを書く](deny-reason-distinguishes-degraded-from-real-denial.md)。判定の内部状態を外に出す同じ発想
- [エージェントが呼ぶスクリプトは無言で成功してはならない](../skill/agent-scripts-must-not-succeed-silently.md)
