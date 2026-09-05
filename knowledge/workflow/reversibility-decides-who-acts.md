---
type: pattern
nature: principle
title: エージェントに任せる操作と人間承認が要る操作の線引きは可逆性で決めるべき
description: >-
  A decision rule for autonomous git-hosting workflows: let the agent create draft PRs, update descriptions,
  reply to threads, and undraft, because each can be undone without touching main, but require an explicit
  human instruction for merge (rewrites main, revert loses squash granularity) and for commenting on other
  people's issues (a notification cannot be un-read). When the harness system prompt forbids PR creation, obey
  the harness and pin the resulting behaviour (ask once, or stop and say so) so the outcome is the same every
  session. Use when two documents disagree about who creates the PR, or when sessions reach different end
  states from the same flow. Not for permission enforcement in hooks, and not for read-only operations.
tags: [workflow, security]
keywords: [可逆性, 取り消せるか, Draft PR, マージ, 明示指示, main を変えない, revert, squash merge, 他人の issue への通知, 既読は戻せない, ハーネスの指示, システムプロンプト, 再現性, AskUserQuestion, 決め打ち, ヘッドレス, claude -p, 既定で進む, defer, ask を deny に]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: human
---

# エージェントに任せる操作と人間承認が要る操作の線引きは可逆性で決める

## 課題

「PR を誰が作るか」について、skill (エージェントが Draft PR を作る) と rules (PR 作成・マージは人間が実施し、明示指示が無い限り実行しない) が逆のことを言っていた。
実運用も揺れ、同じフロー定義を読んでいるのにセッションごとに到達点が変わっていた (あるセッションは Draft PR を作り、別のセッションはリモートへの反映で止まった)。
Claude Code on the web のシステムプロンプトにも「明示的に依頼されない限り PR を作成しない」旨があり、「作らない」方向へ倒れやすい事情もあった。

## 解決

線を引く基準を担当者の役割分担ではなく、**その操作が取り消せるかどうか**に置く。

| 操作 | 取り消し方 | main への影響 | 担当 |
|---|---|---|---|
| Draft PR / MR の作成 | クローズする | 無し | エージェント |
| description 更新、レビュー返信 | 書き直す | 無し | エージェント |
| Draft 解除 | Draft へ戻す | 無し | エージェント |
| **マージ** | revert (履歴は残る、squash なら元の粒度は失われる) | **正史が変わる** | 人間 (明示指示があればエージェントが実行してよい) |
| **他人の issue へのコメント** | クローズしても既読は戻せない | 無し | 投稿前に本文を含めて人間承認 |

PR の作成はレビューを始めるための場を用意する操作にすぎず、作った時点で main は 1 バイトも変わらない。Draft ならレビュアーへの通知も発生しない。
人間の承認を要求する価値があるのはマージだけで、前者にまで都度の指示を求めるとフローの各所で応答待ちが発生するわりに得られる安全性が無い。

他人の issue への通知は「main を変えない」基準では救えない。通知が飛んだ時点で相手の作業文脈に割り込み、誤通知が続くと通知そのものが読まれなくなる
(通知漏れは後続が自力で気づけばよいが、仕組みが自壊するのは誤通知側)。「投稿してよいか」だけを聞かず、投稿先と本文そのものを承認に含める。

### ハーネスの制限とリポジトリ方針が衝突する場合

**ハーネス側の指示を優先する。** リポジトリ内の文書でシステムプロンプトを上書きすることはできないし、「フロー定義に従うことが明示的な依頼にあたる」と
解釈させるのは衝突の解釈をエージェントに都度委ねることで、セッションごとに判断が変わる状態へ逆戻りする。

そのうえで**優先した先の振る舞いを決め打ちにする**。再現性の要点は「必ず PR を作ること」ではなく「毎回同じ判断に到達すること」。

1. ブランチ作成とリモートへの反映までは通常どおり行う
2. Draft PR 作成の直前に `AskUserQuestion` で可否を 1 回だけ確認する。承認されれば通常どおり作る
3. 応答を待てない非対話セッションでは PR を作らずに止め、**「作成していないこと」「作成には明示指示が要ること」を最終応答に明示する**。黙って反映しただけで終わらない

確認が要るのは新規作成だけ。既存 PR の更新はハーネスの指示の対象外として扱う。

### ヘッドレスで応答が無いとき

同じ基準がヘッドレス (`claude -p` など、ユーザーが応答できない実行形態) の倒し方も決める。
合意が取れないからと「候補を報告してセッションを終える」と、その地点で必ず止まり、次のセッションが再開しても何をすべきか決まっていない。
後継プロジェクトはこれを「既定の提案どおりに決めて記録し、進む」へ反転させた。既定が「この MR で対応する」なら、
それを採ることは提示されればユーザーが選んだであろう選択肢を選ぶことに等しく、MR コメントに記録が残るので後から差し戻せる。
既定で進めないのは**取り消せない外部への副作用**だけ (別 issue の起票は他人が見る場所への書き込みで、消しても通知は残る)。
「止まる価値があるのは取り消せない副作用だけ」という 1 行で、対話でもヘッドレスでも同じ表が使える。

なお hook の `permissionDecision` には `ask` の代わりに使える `defer` があるが、`-p` で親プロセスに判断を委ねる統合向けの値で、
対話セッションでは警告を出して無視される。ヘッドレスで「確認を通してしまう」ことを防ぐには `ask` を `deny` に置き換える方が確実。

## 適用条件

- 効く: エージェントがブランチ・PR・レビュー往復を自律的に進めるワークフロー
- 効かない: 権限の機構的強制。これは方針の話で、止めたいなら hook で止める

## トレードオフ

- 得る: 人間の応答待ちがマージと外部通知の 2 点に集約される。到達点がセッションによらず同じになる
- 失う: マージを `--auto` で自動化する案は採れない。main を変える操作をエージェントの判断で走らせることになり、基準と正面から衝突する

## 関連

- [操作をブロックするか注意喚起で済ませるかは特定可能性と代替経路で決める](../hooks/20-PreToolUse/block-vs-notice-hook-selection.md)。方針を機構にするときの判断
- [意味理解を要する判定はエージェントへ委ねスクリプトには決定的な判定だけを置く](../skills/scripts/delegate-meaning-to-agent-keep-scripts-decidable.md)。「影響がある issue か」の判定はエージェントの解釈で、だから人間が 1 回見る
