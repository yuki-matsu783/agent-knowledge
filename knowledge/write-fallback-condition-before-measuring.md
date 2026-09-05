---
type: pattern
title: 実測の前に外れたときの縮退を書いておく
description: >-
  A verification discipline for design decisions that rest on an untested assumption: list the assumption
  in the verification plan (an assumption absent from the plan is never verified), and before measuring,
  write what the design falls back to if the assumption fails, so that the result decides the outcome
  mechanically instead of inviting an after-the-fact argument to keep the design. Also: close open items
  that official documentation answers, but do not let a documentation answer waive a measurement an
  acceptance criterion explicitly demands, and quote sources with their section context. Use when a hook or
  workflow design depends on "the platform delivers X to Y at time Z". Not for choosing what to measure.
tags: [evaluation, workflow]
keywords: [実測, 検証予定表, TBD, 縮退条件, 先に書く, 前提, 外れたとき, 機械的に決まる, 受け入れ条件, 実物の確認, 公式文書で閉じる, 引用の文脈, systemMessage, 17 行]
status: stable
sources: []
---

# 実測の前に外れたときの縮退を書いておく

## 課題

hook の登録表を 17 行に保つ判断が、「PreToolUse の hook が出す `systemMessage` はサブエージェントの起動前にユーザーへ表示される」という前提 1 本で支えられていた。
公式は「Warning message shown to the user」と書いており疑う根拠は無かったが、レビューで 2 つが分かった。

1. 検証予定表 (仕様の TBD 表と計画の実測項目) のどこにも `systemMessage` の行が無い。前の結果報告が「最重要」として申し送っていたのに、届いていなかった
2. TBD 表の縮退条件が、前提が `additionalContext` だった頃の文言のまま残っていた。仕様の縮退の記述とも食い違い、片方だけ届いたときの扱いが不定

**結論を支える前提は、検証の予定表に載っていなければ検証されない。**

## 解決

1. 前提を TBD 表に登録する。同じ起動で確かめられる別の項目 (`tool_response.status` が既定で `async_launched` になるか) も同じ行に置く
2. **実測の前に「外れたときの縮退」を書く。** 「表示されなければ 7 行目の登録を外し、実行者の不一致は起動後の hook の縮退判定に寄せる (16 行に戻る)」
3. 別の問いは別の行にする。「SubagentStart の入力に何が来るか」と「PreToolUse の出力が誰に届くか」は 1 行に混ぜない。片方が外れたときにもう片方まで巻き添えになる

実測の結果、`systemMessage` は VSCode 拡張の対話 UI には表示されず (ヘッドレスの stream-json には level notice で載る)、`additionalContext` は届いた。
縮退条件を先に書いてあったので、結果から結論 (16 行に戻す) までが機械的に決まった。**実測の後に条件を考えていたら「`additionalContext` は届いたのだから」と 17 行を守る議論になっていた。**

### 文書で閉じる項目と実測を残す項目

- 取得済みの公式文書が答えている TBD は閉じる。実測待ちにしておくのは条件の充足度を理由なく下げる
- ただし**受け入れ条件が「実物の確認に基づいて」と書いている項目は、文書での解決を実測の免除にしない**。文書は実測の予測を強くするだけで条件そのものを満たさない。「公式ドキュメントという実物」と解釈を広げない
- 引用は節の文脈ごと正しく。「その他の終了コード (0 と 2 以外)」の節の一文で終了 0 の経路を説明していた引用は、読み手が確かめられない。差し替える

## 適用条件

- 効く: プラットフォームの挙動 (何がいつ誰に届くか) に依存する設計判断。1 つの前提に複数の決定が乗っているとき
- 効かない: 何を測るかの選定そのもの

## トレードオフ

- 得る: 実測が「確認」になり、結果の解釈で揉めない。外れたときの手戻りが見積もれる
- 失う: 前提ごとに縮退案を書く手間。書けない (縮退案が無い) 前提は、その時点で設計の弱点として見える

## 関連

- [Agent ツール周りの hook 入出力の一覧](agent-tool-hook-fields-reference.md)。この実測で確定した事実
- [環境変数で切るプローブと負のコントロールで hook 入力を実測する](env-gated-probe-with-negative-control.md)。実測の仕込み方
- [サブエージェントは既定で background で走り PostToolUse Agent は起動直後に発火する](subagent-runs-in-background-by-default.md)。同じ起動で分かったもう 1 つ
