---
type: pattern
nature: best-practice
title: 縮退で拒否したときの理由文は本来の拒否と分けて何が判定を妨げたかを書くべき
description: >-
  A pattern for fail-closed guards that deliberately over-deny when input cannot be read: write two
  denial messages, the real one ("chmod is banned, run scripts with bash <path>") and the degraded one
  ("could not identify the executable because of a heredoc / variable expansion / quoting, so denied
  on the safe side"), attach a frequency estimate or a measurement plan whenever a false-positive cost is
  accepted, never bypass a false positive (other syntax, split words, disabling the guard), and fix the
  rule in a separate ticket rather than on the spot. Born from a guard that fired on the third Bash call
  after registration because a heredoc body quoted the word chmod, and told the agent it had run chmod.
  Use when a guard has a "cannot decide, so deny" branch. Not for choosing the failure direction itself.
tags: [claude-code, prompting, security]
keywords: [拒否理由, 縮退, 過剰拒否, 誤検知, ヒアドキュメント, 変数展開, クォート, 噛み合わない, 次の一手, 頻度の見積もり, 代償, 迂回しない, ENFORCE=0, 別チケット, block-chmod, fail-closed]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
intervention: hook
---

# 縮退で拒否したときの理由文は本来の拒否と分けて何が判定を妨げたかを書くべき

## 課題

`chmod` を止める guard を「実行体を特定できない段があり、かつコマンド全体に禁止語がある」とき拒否側に倒す設計にし、過剰拒否を**代償として明示的に受け入れた**。ただし頻度は測れていない、と記録していた。

代償は**登録から 3 回目の Bash 呼び出し**で出た。踏んだのは `cat > wip/tmp/x.py <<'PYEOF' … PYEOF` の形で、ヒアドキュメントの本文に文書として引用した `chmod` の語が入っていた。
コマンド分割がクォート・コメント・ヒアドキュメント本文を区別せずプレースホルダに潰していたので、本文由来の段が「実行体を特定できない」と数えられた。
このプロジェクトはヒアドキュメントで一時スクリプトを書き、`chmod` について書く文書を大量に作るので、**踏み続ける構造**だった。

誤検知そのものより重かったのは、表示された理由。

> 禁止コマンド 'chmod' の実行。実行権限の変更は不要で、スクリプトは 'bash <パス>' で実行する。権限変更が本当に必要なら、迂回せずユーザーに提案すること

文書に `chmod` と書いただけの読み手にとって、この文は次の一手を 1 つも示していない。しかも「自分は禁止されたことをした」と信じさせるので、していない以上直しようがない。

## 解決

- **拒否理由の文面を、本来の拒否と縮退の拒否で分けて書く。** 拒否は読み手への指示で、止めるだけなら判定でよく、理由を書くのは次の一手を伝えるため。
  縮退 (材料が揃わないので拒否側に倒した) なら「実行体を特定できない箇所 (ヒアドキュメント・変数展開・クォート・コード文字列) があるため拒否側に倒した」と、**何が判定を妨げたか**を添える。禁止のものをやろうとした、と断定しない。
  読み手から見て縮退の拒否と本来の拒否は別の出来事で、文面を分けることは判定の内部状態を読み手に見せることでもある
- **代償を受け入れる判断には頻度の見積もりを添える。** 見積もれないなら見積もる手段 (実測の予定) を添える。「まれに起きる」と「3 回に 1 回起きる」は同じ設計判断の名前で呼べない。頻度の欄が空のまま承認が通る形が構造的な問題だった
- **過剰拒否を踏んでも迂回しない。** 別のシェル構文で同じことをする、語を分割して書く、ガードの緊急停止を立てる、はいずれも拒否の回避。回避が習慣になると正しい拒否も回避される。
  この例では同じ内容を Write ツール (シェルを起動しない別の道具) で書いた
- **踏んだその場で判定を直さない。** 範囲外の変更として別チケットに立て、元のチケットの目的 (このときは「登録方式と deny の効き方を測る」) を守る。判定ロジックの変更を混ぜると、測定の結果がどの版のものか分からなくなる
- 判定側の是正は、データだけの段 (ヒアドキュメント本文) を実行位置として数えないこと。禁止語を設定から外して隠す、判定を緩めて素通りを作る、は採らない

## 適用条件

- 効く: 読めない入力を拒否側に倒す guard 全般。特に「文書を書く」作業が多く、禁止語が本文に自然に現れるリポジトリ
- 効かない: 拒否の向きそのものの判断。それは [読めない入力はブロック側へ倒す](command-position-match-fails-closed.md) の話

## トレードオフ

- 得る: 過剰拒否を踏んだエージェントが正しい一手 (別の道具で書く、本文をファイルへ逃がす) に辿り着ける。代償の大きさが記録に残り、見直しの根拠になる
- 失う: 文面が 2 系統になり、判定の分岐ごとにどちらを出すかを決める手間

## 関連

- [失敗メッセージに代替手段を名指しで埋め込む](../../mcp/name-the-alternative-in-failure-message.md)。本来の拒否の文面に代替を書く側
- [hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒す](command-position-match-fails-closed.md)。縮退の設計
- [縮退時に判定しなかった分岐も skip を記録する](../22-PostToolUse/record-skips-so-absence-means-degraded.md)。判定の内部状態を記録に出す同じ発想
