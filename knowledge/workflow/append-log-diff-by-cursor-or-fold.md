---
type: pattern
nature: best-practice
title: 追記ログの差分集計は行カーソルか id 畳み込みかを再送の有無で選ぶべき
description: >-
  Gives the rule for incrementally aggregating an append-only agent log (tokens, tool calls, turns) without
  double counting: use a session-global line cursor when a new line always means new information, as in the
  Claude Code transcript, but fold the whole file by message id and diff against a stored total when the tool
  re-emits the same id, as Gemini CLI does from v0.39 for token backfill, tool status transitions and `$set`
  records. Use when building a usage report, a push-time snapshot, or any per-branch cost attribution over
  `~/.claude/projects` or `~/.gemini/tmp`. Explains why the previous total must be keyed by session and never
  by branch, and how to keep a shrunken or recreated log from freezing the counter. Not for reading a log
  once in full, where neither scheme is needed.
tags: [claude-code, gemini-cli, observability, cost]
keywords: [追記ログ, append-only, 行カーソル, lastLineCount, 畳み込み, fold, 累計差分, 二重計上, 再送, セッション単位, ブランチ非依存, needsReset, クランプ, 対応工数, usage report, rewindTo, $set]
status: stable
applies_to: [claude-code@2.1, gemini-cli@0.39]
stale_after: 2027-03-05
sources:
  - https://code.claude.com/docs/en/hooks
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: tool
---

# 追記ログの差分集計は行カーソルか id 畳み込みかを再送の有無で選ぶべき

## 課題

エージェントのセッションログから「前回の区切りからどれだけ使ったか」を繰り返し集計したい。
トークン、ツール実行回数、応答回数を push ごとに出すような処理である。

素直に書くと「毎回ファイル全体を再パースし、前回の累計を引く」形になる。これはブランチをまたぐと壊れる。
新しいブランチには前回スナップショットが無く、蓄積済みの全件がそのブランチの初回差分としてまるごと乗る。

では「前回読んだ行数以降だけを足す」に変えればよいかというと、そうとも限らない。
**追記型 JSONL であることと、新しい行が新しい情報であることは別物**だからである。

## 解決

ログが同じ情報を再送するかどうかで方式を分ける。

| | 行カーソル | id 畳み込み |
|---|---|---|
| 前提 | 新しい行 = まだ数えていない情報 | 同じ id が後の行で上書き・再送される |
| 状態に持つもの | 処理済み行数 (`lastLineCount`) | 指標ごとの前回累計 |
| 差分の取り方 | カーソル以降の行を**足す** (引き算しない) | 全体を id 単位で畳んで前回累計を**引く** |
| 該当 | Claude Code の transcript | Gemini CLI のセッションログ (v0.39 以降) |

Claude Code の transcript は追記専用で、行が後から書き換わらない。カーソルが成り立つ。
Gemini CLI のログはトークンの後埋めやツールの `status` 遷移で同じ `id` の行が何度も現れ、
`{"$set": {...}}` が `messages` を含むと全メッセージがまとめて再送される。ここで新規行を足すと同じメッセージを何度も数える。

どちらの方式でも、**前回の状態はセッション単位でブランチ非依存に置く**。
`state/<branch>.json` に入れると上で述べた「新ブランチの初回でまるごと再計上」を作り直すことになる。
ブランチ帰属が多少不正確になることは許容できるが、同じ範囲を 2 つのブランチへ二重に載せることは許容できない。この 2 つは別の話である。

### 畳み込み側で要る 2 つの安全装置

ログが消えたり作り直されて縮んだときの扱いを決めておく。

- **1 指標でも差分が負なら「作り直された」と判断し、前回累計を今回のスナップショットで必ず上書きする。** 負値は 0 へクランプするので集計値は減らない
- **「差分が全部 0 なら書かずに返す」の判定はクランプ前の値で行う。** クランプ後で判定すると、縮小直後は全指標が 0 になってこの経路に入り、古い大きな累計が残る。以後、新しいセッションがその値を超えるまで無言で欠落し続ける

### 数えるのは残った会話ではなく、かかった手間

Gemini CLI のログには `/rewind` の記録として `{"$rewindTo": "<messageId>"}` が現れ、CLI 本体は会話履歴をそこまで切り詰める。
集計側は**読み飛ばすだけにして、メッセージを削らない**。巻き戻された範囲でも API は呼ばれ、ツールは実行され、人間は応答を読んでいる。
削ると「うまくいかなかった作業ほど工数が小さく見える」という逆向きの歪みが出る。

## 適用条件

- 効くのは、同じログを何度も読み直して増分を出す処理。1 回だけ全部読むならどちらも要らない
- 行カーソルを選ぶ前に、そのツールのログで**同じ id が複数行に現れないか**を実データで確かめる。追記型であることは根拠にならない
- 行番号の基準を 1 つに決める。空行を除いた行数で数えるなら、切り出しも同じ基準で行う。物理行で切る `sed -n 'N,Mp'` と混ぜると空行 1 つでずれる
- 計上済みの id の集合を状態に持つ案は採らない。セッションが伸びるほど際限なく肥大化する。畳み込みなら状態は指標ごとの数値だけで済む

## トレードオフ

- 行カーソルは「一度数えた範囲は二度と数え直さない」という機械的な原則だけで動く。行の中身を一切詮索しないので実装が小さい。
  代わりに、resume でログの行が新しい位置へ再書き出しされた場合、その重複行は新規行として計上される。内容で除外する仕組みは意図的に持たない
- 畳み込みは毎回全体を走査するので、ログが大きいほど遅い。低頻度の処理 (push 時など) でしか使えない。
  代わりに切り詰めや部分削除に本質的な耐性がある。累計が一致すれば差分は 0 になる
- 経路によって記録できるものが変わる。「この行範囲を今回数えた」というインデックスは行カーソル側にしか意味が無い。
  畳み込み側で同じキーに別の意味の値を入れると、読む側が区別できなくなる。**意味を保てないなら記録しない**

## 関連

- [Claude Code の transcript JSONL は /compact を挟んでも追記専用である](transcript-jsonl-is-append-only-across-compact.md)。行カーソルが成り立つ根拠
- [resume したら transcript の行が別ブランチ名で再書き出しされた](transcript-lines-duplicated-on-resume.md)。ブランチ別スナップショット差分が壊れた実例
- [transcript を --argjson で jq に渡したら引数長の上限で無言で止まった](../hooks/scripts/pass-transcript-by-path-not-argv-to-jq.md)。どちらの方式でも中身を argv に載せない
- [transcript の usage トークンが過小に記録されていた](transcript-usage-tokens-undercount.md)。数え方を正しくしても値自体に限界がある
