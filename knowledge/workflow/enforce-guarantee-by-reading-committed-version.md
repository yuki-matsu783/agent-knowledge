---
type: pattern
nature: principle
title: コマンドが約束する保証はコミット済みの版を自分で読んで担保するものであるべき
description: >-
  A pattern for scripts that promise something to reviewers ("every skipped pre-push check is visible in
  the MR diff"): implement the guarantee inside the command by reading only the committed version of its
  input (`git show HEAD:<file>`), never by relying on another check that can itself be skipped. The
  motivating hole: a skip-record file was read from the working tree, and an uncommitted record that said
  "skip check 1 (uncommitted changes)" let the record itself bypass the check that was supposed to force
  it into the diff. Use when a command's contract says "always recorded" or "always in the diff". Not for
  ordinary input validation.
tags: [workflow, security]
keywords: [保証, コミット済み, git show HEAD, 作業ツリー, 未コミット, スキップ記録, push 前チェック, 自己強制, 依存する検査, 飛ばせる検査, MR の差分, 提供コマンド]
status: stable
sources:
  - https://git-scm.com/docs/git-show
intervention: tool
---

# コマンドが約束する保証はコミット済みの版を自分で読んで担保する

## 課題

push コマンドは push 前チェックの項目を、記録ファイルに理由を書けば意図的に飛ばせる。仕様は「記録ファイル自体が未コミットなら項目 1 (未コミットの変更が無い) で止まる = 記録は必ず MR の差分になる」と書き、
記録が人間のレビューに見えることを保証していた。

レビューで、未コミットの記録に「項目 1: 理由」と書けば**項目 1 自身が飛び**、記録が一度も MR に現れないまま push できることが分かった。
保証が、保証の対象 (スキップ) によって無効化できる検査に依存していた。

## 解決

- push コマンドはスキップ記録を **HEAD にあるコミット済みの版** (`git show HEAD:wip/push-check-skip.md`) からだけ読む。作業ツリーの未コミットの内容は読まない。
  記録を HEAD から読めば、push されるコミットに記録が含まれることが構造的に決まる。項目 1 をどう飛ばしても変わらない
- 一般則として、コマンドが仕様で約束する保証 (「必ず差分に現れる」「必ず記録される」) は、**そのコマンド自身が読む入力の版**で担保する。飛ばせる検査項目や別コマンドの検査に依存する保証を書かない。
  「検査 A が検査 B の前提を守る」という保証は、A がスキップ可能になった時点で崩れる。依存を持たない方が、後から検査項目を増減しても保証が壊れない
- 仕様の文言も「項目 1 で止まる」から「コミット済みの版だけを読む」に改める。保証の根拠を実装の形で書く

却下した案: 項目 1 をスキップ不可にする (別セッションの作業ファイルが作業ツリーにある状態で push したい場面が実際にある)。記録が未コミットなら別の識別子で止める (記録以外の依存には同じ穴が残る。読む版を固定する方が一般的に効く)。
記録をコマンドが内部でコミットする (ユーザーの意図しないコミットを作る。対象を明示させる規約に反する)。

## 適用条件

- 効く: エージェントが呼ぶ提供コマンドが「レビュアーに見える」ことを約束する場面。特に、その約束を破る手段がエージェント自身の書き込みであるとき
- 効かない: 通常の入力検証。ここで問題なのは検査の存在ではなく検査の依存関係

## トレードオフ

- 得る: 保証が構造的になり、検査項目の増減で壊れない。実装は `git show` 1 回
- 失う: 記録を書いた直後の push では、記録をコミットしてからでないと効かない。1 手増えるが、それこそが「記録が差分に載る」の意味

## 関連

- [エージェントが書く宣言で権限を広げられない](../hooks/agent-written-declarations-cannot-widen-permissions.md)。エージェントの書き込みを信頼しない同じ構図
- [ルールの文言強化ではなく記録とゲートで抜けを塞ぐ](../rules/close-gaps-with-mechanism-not-wording.md)。ゲート側の実装の注意
- [エージェントが呼ぶスクリプトは無言で成功してはならない](../skills/agent-scripts-must-not-succeed-silently.md)
