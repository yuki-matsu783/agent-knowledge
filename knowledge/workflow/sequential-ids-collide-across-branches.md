---
type: pitfall
nature: fact
title: 連番 ID はブランチ並行で必ず衝突し git はそれを報告しない
description: >-
  Explains why numbering decision records (or any per-file documents) with a monotonically increasing
  sequence such as 0027-title.md breaks under parallel branches: two branches independently take the same
  next number, and because the file names differ git merges both without reporting a conflict, leaving two
  records with one id and forcing a renumber that ripples through titles, indexes, and every cross-reference
  (one such renumber left a stale comment pointing at a non-existent record). Use when choosing an id scheme
  for ADRs, DDRs, migrations, or similar files that agents create on feature branches, or when the same
  "semantic conflict" keeps recurring after merges. Not for content conflicts that git does detect, and not
  a general argument against numbered ADRs in a single-writer repository.
tags: [workflow, meta]
keywords: [連番, 採番, 衝突, semantic conflict, git が報告しない, ADR, DDR, 改番, 参照追従漏れ, issue 番号ベース, ゼロ埋め, 辞書順, 枝番, 中央採番, 単調増加カウンタ, worktree, 本流だけが採番, 種類が違えば衝突せず合流]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# 連番 ID はブランチ並行で必ず衝突し git はそれを報告しない

## 症状

決定記録を `NNNN-タイトル.md` の 4 桁連番で管理していたリポジトリで、過去 4 回のマージ時コンフリクトが**すべて**この番号の衝突だった。
しかも `git merge` は何も言わない。`0027-A.md` と `0027-B.md` はファイル名が違うので、git は両方をそのままマージし、同じ番号の記録が 2 つ並ぶ。
`git merge-tree` で確認しても、他ファイルのテキストコンフリクトは報告するのに、番号の重複については一言も出ない。

## 原因

**分散したブランチ上で共有の単調増加カウンタを採番する設計**になっている。git に単調増加カウンタを衝突なく採番する手段は原理的に無い。
「`git merge` を試して衝突が出るか見る」という素朴な確認では、最も頻発している衝突を検知できない。

対処側にも固有の危険がある。改番はファイル名だけでなく frontmatter の `title`、本文冒頭の見出し、一覧、他ファイルからの参照に及ぶ。
実際に改番したとき `.gitignore` のコメントが古い番号のまま残り、存在しない記録を指し続けた。

## 回避策

**採番方式そのものを変える。** 中央で採番される識別子 (issue 番号) を ID にする。

- ファイル名を `i<issue番号 4 桁ゼロ埋め>-<枝番 2 桁>-<タイトル>.md` にする。issue 番号は GitHub / GitLab が中央で採番するので、別ブランチ同士で同じ識別子が生まれることが原理的に無い
- 枝番は同一 issue (同一ブランチ) 内で閉じるので衝突しない。1 件でも `01` を省略しない (後から 2 件目を足すときに 1 件目の改番が要る)
- **ゼロ埋めする**理由は、一覧生成が `LC_ALL=C` のファイル名昇順で並ぶため。埋めないと `i106, i11, i112, …, i3` と数値順にならない。
  上限は設けず 4 桁以上とし、9999 を超えたら 5 桁で書く (桁が増える側が辞書順で必ず後ろに来る)
- 接頭辞は小文字 `i` に固定する。表記の揺れを許すと同じ記録が別の識別子として二重に採番される
- 対応する issue が無い過去の記録には予約番号 `i0000-NN` を振る。新しく `i0000` を作ることはない
- 重複検知の機構は残す。旧形式のファイル同士、あるいは同一 issue を 2 ブランチで並行して進めた場合の枝番衝突は新方式でも残る
  ([detect-conflicts-with-merge-tree.md](detect-conflicts-with-merge-tree.md))

**同じ issue の中で worktree を並列にすると、枝番でも同じ衝突が起きる。** 後継プロジェクトの実測では、2 つの作業ツリーがどちらも
`0011` を採り、種類が違ったので `0011-design.md` と `0011-investigation.md` という別名になり、`git merge` は衝突せず成功して
同じ番号のチケットが 2 枚並んだ。番号で 1 枚を引く処理は先に当たった方を返し、一覧には同じ番号が 2 回載る。人が気づく機会が無い。
ここでの解は**採番する場所を 1 つ (本流のチェックアウト) に限る**こと。並列するのは番号が決まった後の実施チケットだけで、
番号を新しく採るのは直列に本流を走る計画の作業なので、作業ツリーでの新規作成を拒否して本流で作るよう案内すれば重複は構造的に起きない。
複合キーや ULID への変更、合流時の重複検査、採番時に他の作業ツリーを走査する案は、番号体系への波及・事後検知・同時作成の競合の点で割に合わない。
本流かどうかは `.git` がディレクトリかファイルかで分かる (git を呼ばない)。

却下した案: 採番をマージ直前まで遅延させる (窓が狭まるだけで無くならず、レビュー後に改番で差分が動く)。担当者ごとに番号レンジを割る (中央の合意が要る点で issue 番号と同じで、枯渇の再割り当てが運用コストとして残る)。

既存の連番を全件改番するかは判断が要る。併存すると以後すべての読み書きで「どちらの方式か」を意識し続けるので、追従漏れのリスクを一度だけ引き受けて改番する方が安い。
その場合、置換は機械的に行い、全リンクが実ファイルへ解決することを検証し、過去のコミットメッセージや changelog の引用は書き換えない。

## 再現条件

エージェントが feature ブランチごとに決定記録を 1 件以上追加し、複数ブランチが並行する運用。単一の書き手が main へ直接コミットするなら起きない。
同一ブランチでも、git worktree で複数の作業ツリーが同時にファイルを採番すると同じことが起きる。

## 関連

- [merge-tree で作業ツリーを汚さずにベースブランチとの衝突を検知する](detect-conflicts-with-merge-tree.md)。番号重複を直接調べる検知の作り方
- [設計書の隣に決定ログを置く](decision-log-beside-design-docs.md)。決定記録を置く場所の話。こちらはその ID の話
- [並列で走らせるエージェントは git worktree で隔離する](../agents/parallel-agents-isolated-by-worktree.md)。worktree 並列で採番が本流限定になる理由
