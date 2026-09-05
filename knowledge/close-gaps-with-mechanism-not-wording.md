---
type: pattern
title: ルールの文言強化ではなく記録とゲートで抜けを塞ぐ
description: >-
  A pattern for process failures that happen even though the rule is already written in bold: split the
  causes into "did not follow" and "could not be followed" (the fact lived only in the conversation, or the
  progress record tracked one of two obligations), then add a recorded state (a header line such as
  "unreplied threads: N" in the handoff file) and a gate in the script that advances progress (refuse to mark
  a loop done unless that value is 0, and treat a missing line as unchecked). Use when an agent skips a
  documented verification step and the proposed fix is to restate the rule more strongly. Not an adversarial
  boundary (the agent writes the value itself), and not for rules whose violation can be blocked directly at
  the tool call.
tags: [claude-code, workflow]
keywords: [文言強化, 機構, ゲート, 記録の欠落, 記録の粒度, HANDOFF, 未返信スレッド, mark-done, 拒否, 非対称, デッドロック, 手順の飛ばし, 守れる形, うっかり, 既定動作]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# ルールの文言強化ではなく記録とゲートで抜けを塞ぐ

## 課題

敵対的レビューが PR へ 10 件のスレッドを投稿し、エージェントは指摘をすべてレポートへ反映して人間の合意を得てループを閉じた。
**しかし 10 スレッドのいずれにも返信が付いていなかった。** 「返信が 1 件も付いていないスレッドが残っていないか確認する」というルールは
既に太字で書かれていて、それでも起きた。

原因を分解すると 4 つあり、性質が 2 種類に分かれる。

| 原因 | 種類 |
|---|---|
| スレッドを取得するサブコマンドを実行しなかった (指摘内容が会話に残っていたので直接直せてしまった) | 守らなかった |
| 完了確認の節がフロー表から離れていて、ループを閉じる操作の前提として結び付いていなかった | 守らなかった |
| **投稿したスレッドの存在が会話にしか無かった。** 投稿と返信の間にセッションが切れれば情報ごと消える | 記録の欠落 |
| **引き継ぎファイルが「反映した」と書けてしまう。** 義務は〈修正〉と〈返信〉の 2 つなのに記録は片方しか追わない | 記録の粒度 |

前 2 つは文言でも効くが、後 2 つは同じ種類の対策を重ねても残る。

## 解決

1. **記録する場所を作る。** 引き継ぎファイルのヘッダに `- 未返信スレッド:` の行を新設し、確認した結果を書く
2. **進捗を進める操作にゲートを置く。** ループ範囲を完了にするスクリプトは、この値が `0` でなければ 1 件も書き換えずに拒否する。
   **行が存在しない場合も「未確認」とみなして拒否する** (行が無ければ通す、にすると雛形を持たない古いファイルで機構が丸ごと無効になる)
3. **書き手側は行を挿入する。** 値を書くコマンドは、行が無ければ自分で挿入する。検査側と書き手側で「行が無いとき」の扱いを変えるのは
   意図的な非対称で、そうしないと拒否された側が値を書けずデッドロックする
4. 投稿する側の手順に、投稿直後に件数を記録することを義務として加える。雛形にもこの行を含める

本質は **「0 を明示的に書く」という操作が要るようになる**こと。確認する手順に到達しなかったのが原因なら、ゲートで止まれば必ず到達する。

## 適用条件

- 効く: 「うっかり飛ばす」型の抜け。既に「ループ範囲の一部だけを完了扱いにできない」のような制約を機械的に強制しているスクリプトがあれば、同じ場所へ同じ形で足せる
- 効かない: 値を書くのはエージェント自身なので嘘を書けば通る。敵対的な安全境界ではなく、既定動作を確実な方向へ倒す仕組み
- ツール呼び出しの時点で直接止められる操作なら、そちら ([block-vs-notice-hook-selection.md](block-vs-notice-hook-selection.md)) の方が単純

## トレードオフ

- 得る: ルールを読んでいなくても、進捗を進めようとした瞬間に確認へ引き戻される
- 失う: ヘッダ行が 1 つ増え、旧形式のファイルでは最初の 1 回だけ手で足す必要がある
- 却下した案: 未返信スレッドを列挙するスクリプトを新設する。CLI が無い実行環境では動かないので、取得はエージェントが行い、**結果の記録と検査だけを機構化する**

## 関連

- [操作をブロックするか注意喚起で済ませるかは特定可能性と代替経路で決める](block-vs-notice-hook-selection.md)
- [エージェントが呼ぶスクリプトは無言で成功してはならない](agent-scripts-must-not-succeed-silently.md)。ゲートの拒否も「書き戻さず非 0」の一形態
- [敵対的レビューは独立コンテキストの読み取り専用サブエージェントに切り出す](adversarial-review-in-isolated-subagent.md)
