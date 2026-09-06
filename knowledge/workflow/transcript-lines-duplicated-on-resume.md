---
type: pitfall
nature: finding
title: resume したら transcript の行が別ブランチ名で再書き出しされた
description: >-
  Explains why a usage report that re-parses the whole Claude Code transcript and subtracts the previous
  snapshot suddenly counts a session's entire history against a new branch: resuming a session on another
  branch rewrites past lines with the new `gitBranch`, so the same `uuid` appears several times (1178 assistant
  lines for 533 distinct uuids in one real file). Use when tool counts or token totals in a per-branch report
  jump on the first push from a resumed session, or when tempted to deduplicate transcript lines by uuid. Not
  for the token undercount problem, which is a different defect, and not a claim that duplicate uuids are a
  bug: uuid is a node id in the parentUuid chain and repetition is normal.
tags: [claude-code, observability, cost]
keywords: [resume, transcript, uuid, parentUuid, 重複行, gitBranch, 二重計上, 行カーソル, lastLineCount, スナップショット差分, セッション横断, 再書き出し, 対応工数]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
stale_after: 2027-03-05
---

# resume したら transcript の行が別ブランチ名で再書き出しされた

## 症状

ブランチ単位の対応工数レポートで、resume したセッションが新しいブランチで初めて push した瞬間に、
過去に別ブランチで計上済みの全件がそのブランチの初回差分としてまるごと乗る。利用者からは
「利用したツール数が明らかにずれている」と報告された。

## 原因

実 transcript を調べると、`assistant` 行 1178 件に対して `uuid` の固有数は 533 件 (約 2.2 倍) だった。
ある uuid は 4 回現れ、3 回は `gitBranch: feature-39-...`、最後の 1 回だけ `gitBranch: feature-45-...` になっていた。
同一セッションを複数回・複数ブランチで resume すると、Claude Code が過去の行を「resume 時点の gitBranch」で再度書き出すと推測される。

「毎回全件を再パースし、前回の累計との差分を引き算する」方式では、新しいブランチには前回スナップショットが無く、
蓄積済みの全件が初回差分になる。

## 回避策

**行の中身を判断基準にせず、「一度数えた範囲は二度と数え直さない」だけを守る。**

- 処理済み行数 (`lastLineCount`、空行を除く) を**ブランチに紐付けずセッション単位で**記録し、push ごとにその位置以降の新規行だけを集計して加算する (引き算はしない)
- セッションが別ブランチへ resume されても、そのブランチでの新規行が無ければ状態は変わらないので、過去ブランチ分の再計上が起きない

**uuid で重複排除してはいけない。** 一度その案で進めかけたが、`uuid` は会話木のノード識別子 (`parentUuid` によるチェーン) であり、
同じ uuid が複数箇所に現れること自体は異常ではないと指摘されて取り下げた。

既知の限界として、resume で再書き出しされた行は物理的に新しい位置に現れるので、それ自体は新規行として計上される。
内容の重複を判別する仕組みは意図的に持たない。

## 再現条件

元リポジトリの実データ (`~/.claude/projects` 配下の transcript を jq で調査)。Claude Code のバージョンは記録されていない。

## 関連

- [Claude Code の transcript JSONL は /compact を挟んでも追記専用である](transcript-jsonl-is-append-only-across-compact.md)。行カーソル方式が成り立つ根拠
- [transcript の usage トークンは過小に記録されることがある](transcript-usage-tokens-undercount.md)
- [追記ログの差分集計は行カーソルか id 畳み込みかを再送の有無で選ぶ](append-log-diff-by-cursor-or-fold.md)。この回避策を方式の選択として一般化したもの
