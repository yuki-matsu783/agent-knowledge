---
type: reference
title: エージェントからインラインレビューコメントを投稿するときのプロバイダ制約
description: >-
  Lists what GitHub and GitLab actually accept when an agent posts review findings as inline comments: GitHub
  pull-request reviews are atomic (one invalid line makes the whole review fail with 422), submitted reviews
  cannot be deleted, valid lines are only the new-side ranges in each hunk header of the file patch, and
  GitLab discussions require new_line for added lines, old_line for removed lines, both for context lines,
  plus old_path/new_path always. Also records how to degrade findings that name no line. Use when writing
  the posting step of an automated reviewer or debugging a 422 / "must be a valid line code" error. Not for
  reading review threads, which is a different API surface, and not verified beyond GitHub.com and GitLab CE
  18.5.
tags: [claude-code, tool-use, workflow]
keywords: [インラインコメント, "pulls/reviews", "comments array", "422", アトミック, 削除できない, "hunk ヘッダ", 有効行, discussions, new_line, old_line, old_path, new_path, "must be a valid line code", findings, 縮退, サマリへ回す, 投稿上限]
status: stable
sources:
  - https://docs.github.com/en/rest/pulls/reviews
  - https://docs.gitlab.com/api/discussions/
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# エージェントからインラインレビューコメントを投稿するときのプロバイダ制約

## 対象

GitHub.com の REST API (`pulls/<n>/reviews`、`pulls/<n>/files`) と GitLab CE 18.5.4 の `merge_requests/<iid>/discussions`。
自動レビュー (敵対的レビューのサブエージェント) が返す findings を、投稿の直前にプロバイダごとの制約へ合わせて縮退させるために調べたもの。
findings のスキーマはプロバイダ非依存 (`path` / `line` / `old_line` / `old_path` / `side`) のまま、変換だけをプロバイダ層に置く。

## 一覧

| 項目 | GitHub | GitLab | 備考 |
|---|---|---|---|
| 投稿の単位 | 1 レビューに複数コメント。**アトミック**で、1 件でも不正な行があると**レビュー全体が 422** | discussion 1 件ずつ独立したリクエスト | GitHub で 1 件 1 レビューにするとレビュアーへの通知が指摘の数だけ飛ぶ |
| 事後の取り消し | **提出済みレビューは削除できない** (個々のコメントは削除できる) | discussion は削除できる | 「投稿してから取り消す」前提の設計はできない |
| コメントを付けられる行 | `pulls/<n>/files` の `.patch` の hunk ヘッダ `@@ -a,b +c,d @@` が示す新ファイル側の範囲 (追加行・コンテキスト行) | 追加行は `new_line` のみ、削除行は `old_line` のみ、コンテキスト行は両方 | GitLab で違反すると `400 Bad request - Note {:line_code=>["must be a valid line code"]}` |
| パス | `path` | `old_path` / `new_path` を**常に要求** | 片方しか無い場合は同じ値で埋める |
| 有効行の持ち方 | hunk ヘッダから範囲 `[開始, 終了]` で持つ。`d` 省略の `@@ -a,b +c @@` は 1 行、純粋な削除 hunk (`d` が 0) は新側に行を持たないので除外 | 行種別ごとのキー出し分け | 行を 1 つずつ列挙すると差分の大きさに比例して jq への入力が増え、引数長上限 (Windows で約 32KB) に当たる |

## 補足

**行を指せない指摘の扱い。** 設計の一貫性・命名・観点の漏れ・テストの欠落など、ファイル全体にかかる指摘は敵対的レビューで一定の割合を占め、
最も価値のある部類でもある。捨てずに次の順で縮退させる。

1. `line` を持たない finding は、そのファイルの有効行の最小値へ寄せる。新規追加ファイルは hunk が `@@ -0,0 +1,N @@` なので 1 行目に一致する。
   「1 行目に書けばよい」という当初の合意は、**既存ファイルの部分変更では 1 行目が diff に含まれない**ため成立しなかった
2. 有効行を持たないファイル (diff に現れない、`patch` が省略された) の指摘は、レビュー本文 (サマリ) へ回す。有効行の集合が空なら自動的にそうなる。
   戻り値で `{"posted":N,"summarized":M}` の件数を返す

**投稿前に絞る。** 取り返しがつかない前提に立ち、確度と重大度による投稿／報告の振り分けと 1 回あたりの投稿上限 (10 件) を投稿の**前**に効かせる。

**findings はファイル経由で渡す。** 件数と本文の長さで可変長なので `--argjson` の引数長問題を踏むうえ、コマンド文字列に指摘本文が乗ると
hook の部分一致検知 (`git` と `commit` / `push` の連続) を誤って発火させうる。

## 関連

- [敵対的レビューは独立コンテキストの読み取り専用サブエージェントに切り出す](adversarial-review-in-isolated-subagent.md)
- [transcript の user 行の message.content は配列とは限らない](transcript-user-content-may-be-string.md)。同じ引数長上限の実例
