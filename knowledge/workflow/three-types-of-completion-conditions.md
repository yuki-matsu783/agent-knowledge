---
type: pattern
nature: heuristic
title: 完了条件は達成型・収束型・判定型に分けて達成型だけを Stop hook に置いた方がよさそう
description: >-
  A classification for the "done" condition of an unattended Claude Code task, each with its own enforcement:
  achievement conditions (a command exits 0, a file exists) are checked mechanically by a Stop hook or /goal;
  convergence conditions (find all bugs, migrate every call site) end on "two consecutive turns with nothing new"
  and must carry a turn cap; judgment conditions (readable, well designed) split into necessary conditions that a
  hook can check and a sufficiency verdict by a separate evaluator that never did the work. Use when writing the
  completion condition into a ticket, a /goal, or a Stop hook, or when a loop never ends or ends on an empty pass.
  Not for choosing the hook event or writing the hook script itself, which are covered separately.
tags: [claude-code, workflow, evaluation]
keywords: [完了条件, Definition of Done, 達成型, 収束型, 判定型, Stop hook, /goal, evaluator, 打ち切り, turn cap, or stop after 20 turns, 無限ループ, 空振り完了, 自己評価, 別エージェント, サブエージェント, stop_hook_active, 8 回上限, 必要条件, 十分条件]
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/goal
  - https://code.claude.com/docs/en/best-practices
  - https://zenn.dev/gemcook/articles/467b1233efe811
  - https://anthropic.com/engineering/harness-design-long-running-apps
intervention: hook
---

# 完了条件は達成型・収束型・判定型に分けて達成型だけを Stop hook に置く

## 課題

放置したループが終わらない、あるいは中身が無いのに終わる。gemcook の記事はこれを 2 件の事故で示している。
空の XML タグが「タグがある」という検査を通って完了になった件と、到達できない条件で無限に回った件。どちらもプロンプトの言い回しは関係なく、
**完了条件の種類を取り違えて、合わない検査を当てていた**のが原因だった。

Claude Code 側の道具は 3 つある (公式 best-practices と /goal 文書)。Stop hook はスクリプトで機械判定し、8 回連続 block で強制終了する。
`/goal` は小型モデルが毎ターン会話を読んで「未達 / 達成 / 不可能」を判定し、tool 呼び出しの無いターンが続くと止まる。判定モデルはコマンドを実行せず
ファイルも読まないので、条件は「Claude の出力に現れるもの」でないと判定できない。サブエージェントは fresh な context で結果を見る。
道具が 3 つあるのに、条件を 1 種類だと思って書くと、どれかが合わない。

## 解決

完了条件を書く前に 3 型のどれかを決め、型ごとに検査の置き場を変える。

| 型 | 定義 | 良い例 | 悪い例 | 検査の置き場 | 取り違えたときの症状 |
|---|---|---|---|---|---|
| **達成型** | コマンドが決定的に真偽を返す | `pnpm check` が exit 0、`git status --porcelain` が空、ファイルが存在し 1 行以上ある | 「テストが通ること」(どのコマンドか無い) | Stop hook のスクリプト。または `/goal` に「`pnpm check` exits 0」とコマンドごと書く | 存在だけ見て中身を見ない検査 (空タグが通る) |
| **収束型** | 終わりの件数が事前に分からない | 「2 ターン連続で新しい finding が 0 件、**または 20 ターンで打ち切り**」 | 「バグを全部見つける」(上限なし) | `/goal` の条件文に収束則と上限を書く。Stop hook なら logs/ に前ターンの件数を持って比べる | 上限が無く、判定モデルが「まだあるかも」と言い続けて回る |
| **判定型** | 人の判断が要る品質 | 必要条件「見出しが 3 つ以上、リンク切れ 0」+ 十分条件「別エージェントが読んで入口が 30 秒で分かると答える」 | 「読みやすいこと」「品質が十分なこと」 | 必要条件だけ Stop hook。十分条件は fresh なサブエージェントか prompt 型 Stop hook に**作業者以外**が判定 | 作業者が自己採点して「明らかに凡庸でも自信を持って褒める」(Anthropic の観察) |

### 達成型

書き方は「コマンド + 期待する終了コードや出力」。公式 /goal 文書の 3 点 (測れる終了状態、証明の仕方、変えてはいけない制約) をそのまま使う。
制約の例は Anthropic の harness の「テストを消したり書き換えたりするのは許容しない」。制約が無いと、検査を通すためにテストが消える。

Stop hook に置くときは、チケットに書いた条件を hook が読んで機械的に走らせる
([完了時にやらせたい作業はチケットに置き Stop hook で 1 回だけ機械的に差し戻すべき](../hooks/11-Stop/return-once-with-the-ticket-checklist.md))。
判定を hook のプロンプトに書かない。達成型は判定が要らないのが利点で、そこに LLM を挟むと収束型や判定型の問題を持ち込む。

### 収束型

件数が分からない作業は、終わりを「変化が止まったこと」で定義する。「2 ターン連続で新規 0 件」が基本形で、**打ち切りを必ず付ける**。
公式も `or stop after 20 turns` を条件文に含めることを勧めていて、Claude がターンごとに進捗を報告し判定モデルがそれを読む。

打ち切りに達したら「未完了で終了」を成功として扱い、残りをチケットの「次にやること」に書かせる。打ち切りを失敗扱いにすると、モデルが上限直前で完了を宣言しにいく。

### 判定型

「読みやすい」「設計が良い」は exit code にならない。必要条件 (見出しの数、リンク切れ、lint の error 0) を切り出して達成型として hook に置き、
残った十分条件だけを判定に回す。判定は作業した context と分ける。Anthropic の harness 設計記事は、generator と evaluator を分けたうえで
sprint ごとに 27 個以上の検査可能な criteria を先に合意させ、evaluator が実際にページを操作して採点したと書いている。
このリポジトリでは fresh なサブエージェントのレビューが同じ役目を持つ
([敵対的レビューは独立コンテキストの読み取り専用サブエージェントに切り出すべき](../agents/adversarial-review-in-isolated-subagent.md))。

判定型にも収束則を入れる。「レビューで新しい指摘が 0 件になったら終わり、または 3 往復で打ち切り」。指摘を探せと言われたレビュアーは
健全な成果にも何か言うので (公式 best-practices の注意)、正しさか要件に触れるものだけを指摘と数える。

## 適用条件

- 効く: 放置運用のチケット、`/goal` の条件文、Stop hook のチェックリストを書くとき
- 1 チケットに 3 型が混ざるのは普通。達成型は hook、収束型は /goal の条件文、判定型はレビュー工程、と 1 つずつ置き場を書く
- 対話しながら進める作業では人が判定型を担うので、達成型だけ hook に置けば足りる
- 分類は gemcook の 3 型と公式 /goal 文書に基づく。このリポジトリのチケットで 3 型を書き分けて運用した実績はまだ無い

## トレードオフ

- 得る: 無限ループと空振り完了が構造的に消える。「完了条件の設計が構造で、プロンプトの強さは装飾」(gemcook)
- 失う: チケットを書く段階で条件の型を考える手間。収束型の上限は当てずっぽうで始めることになり、低すぎると途中で切れ、高すぎると回り続ける
- 判定型を別エージェントに回すとトークンが増える。必要条件を切り出して達成型に寄せるほど安くなるので、そこに時間を使う

## 関連

- [完了時にやらせたい作業はチケットに置き Stop hook で 1 回だけ機械的に差し戻すべき](../hooks/11-Stop/return-once-with-the-ticket-checklist.md)。達成型の受け皿
- [敵対的レビューは独立コンテキストの読み取り専用サブエージェントに切り出すべき](../agents/adversarial-review-in-isolated-subagent.md)。判定型の受け皿
- [Stop の 2 回目は prompt 型 hook で Haiku に最終報告をレビューさせた方がよさそう](../hooks/11-Stop/haiku-prompt-hook-reviews-final-report-on-second-stop.md)。判定型の十分条件を Stop hook 側で安く済ませる形
- [同じコマンドの失敗は PostToolUseFailure で数えて段階的に介入した方がよさそう](../hooks/23-PostToolUseFailure/count-repeated-failures-then-escalate.md)。条件に届かず回るときの下限の安全網
- [失敗した手は context ではなくチケットの Do-Not-Repeat 節に残して次の context に渡した方がよさそう](keep-do-not-repeat-list-outside-context.md)。打ち切りで終えた後に残すもの
