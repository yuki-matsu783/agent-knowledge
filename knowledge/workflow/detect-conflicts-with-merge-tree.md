---
type: how-to
nature: best-practice
title: ベースブランチとの衝突は merge-tree で作業ツリーを汚さずに検知すべき
description: >-
  Steps for a script an agent runs before asking for a merge: fetch the base branch, run `git merge-tree
  --write-tree` (which touches neither the index nor the working tree) to detect textual conflicts, then
  separately list decision-record files from both trees and report any id shared by two different paths,
  because git does not flag that case; output one JSON object with `hasConflict` as a field rather than the
  exit code so `set -e` callers do not stop on a normal "yes there is a conflict" result. Use when a workflow
  needs a conflict gate before undrafting or merging, or when a `git merge` + `git merge --abort` probe has
  left a repository half-merged. Not for resolving conflicts, which needs human approval per category, and
  not for checking whether the branch is merely behind, which is a different question.
tags: [workflow]
keywords: [git merge-tree, --write-tree, コンフリクト検知, 作業ツリーを変えない, hasConflict, JSON 出力, set -e, 終了コード, DDR 番号重複, 連番, 最終ゲート, Draft 解除前, rebase しない, behind と conflict は別]
status: stable
sources:
  - https://git-scm.com/docs/git-merge-tree
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: tool
---

# merge-tree で作業ツリーを汚さずにベースブランチとの衝突を検知する

## 前提

git 2.38 以降 (`merge-tree --write-tree` が使える)。作業ブランチは既にリモートへ反映済みで、レビューコメントがコミット SHA に紐づいている前提。
だから取り込みは `git merge` で行い `git rebase` は使わない (履歴を書き換えるとレビュアーのチェックアウトと MR 上の参照リンクが壊れる。squash merge なら途中のマージコミットは main に残らない)。

## 手順

1. ベースブランチを取得する。検知そのものが目的のスクリプトでは fetch の失敗を握りつぶさず、結果 JSON に `fetchOk` として出す。
   失敗して古い `origin/main` を読むと「遅れていない」と区別が付かず、誤検知の向きが安全側でない

   ```sh
   git fetch origin "$base"; fetch_ok=$?
   ```

2. テキストコンフリクトを `merge-tree` で判定する。インデックスにも作業ツリーにも触れない

   ```sh
   if git merge-tree --write-tree "origin/$base" HEAD >/dev/null 2>&1; then text_conflict=false; else text_conflict=true; fi
   ```

3. git が報告しない衝突を別に調べる。両ブランチのツリーから決定記録のファイルを列挙し、識別子でグルーピングして、相異なるパスが 2 つ以上ある識別子を報告する

   ```sh
   { git ls-tree -r --name-only "origin/$base" -- docs/ddr; git ls-tree -r --name-only HEAD -- docs/ddr; } \
     | sort -u | sed -E 's#^.*/(i[0-9]{4,}-[0-9]{2})-.*$#\1 &#' | sort | awk '{ if ($1==prev) dup[$1]=1; prev=$1 } END { for (k in dup) print k }'
   ```

4. 結果を 1 つの JSON で返す。衝突の有無は**終了コードではなく `hasConflict` フィールド**で表す。呼び出し元が `set -e` 配下でも「衝突がある」という正常な結果で停止しない

   ```json
   {"hasConflict":true,"textConflict":false,"duplicateDdrNumbers":["i0133-03"],"fetchOk":true,"isShallow":false}
   ```

5. 解消は別の skill に分け、実行前に必ず人間の承認を取る。解消方法が一意に決まる類型 (番号重複は作業ブランチ側を繰り下げる、管理外にした生成物は片側を捨てて再生成する) だけを
   監視モードでの自動解消の対象にし、同じロジックが両側で変わった類型は止めて人間に聞く

## 確認方法

- 実際に衝突した過去のマージの両親コミットに対して実行し、テキストコンフリクトは報告され、番号重複も報告されることを確かめる
- `git status` が実行前後で変わらないことを確かめる

## つまずきどころ

- 「衝突しないこと」と「最新であること」は別。ベース側でルールや仕様だけが追記された場合、テキストコンフリクトも番号重複も起きず `hasConflict` は偽のまま。
  behind の判定 (`git rev-list --left-right --count origin/<base>...HEAD`) は判定軸が違うので同じスクリプトに相乗りさせず、別スクリプトで `isBehind` を返す。
  merge-base が無いと 3 ドット記法の diff は終了コード 128 で落ちる (`rev-list` は成功してしまう) ので、先に `hasCommonHistory` を判定する
- push 検知 hook のたびに走らせない。マージ依頼の直前に 1 回で足り、部分一致で誤発火する hook の上に fetch を積むと無駄が増える
- [連番 ID はブランチ並行で必ず衝突し git はそれを報告しない](sequential-ids-collide-across-branches.md)。手順 3 が要る理由
- [意味理解を要する判定はエージェントへ委ねスクリプトには決定的な判定だけを置く](../skills/scripts/delegate-meaning-to-agent-keep-scripts-decidable.md)。番号重複は決定的に判定できるので機構化できた
