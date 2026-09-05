---
type: note
nature: opinion
title: 計画の直後に初期化サブエージェントを走らせてコマンドの動作確認と手順書を作らせるとよいはず
description: >-
  Idea for a "preflight" subagent that runs once, after the main Claude Code agent has drafted the
  overall plan in plan mode and before it fans work out to other subagents: it reads every planned
  task, extracts the build / test / git / shell commands those tasks will run, checks that each one
  actually works in this environment (and in each git worktree the plan will use), writes the
  runnable procedure and any helper scripts into a file, and reports failures so the main agent can
  ask the user once at the start instead of letting each subagent hit the same error later. Use when
  designing a multi-agent session where several subagents will run the same toolchain, or when
  deciding what belongs in a SessionStart hook versus a task-aware subagent. Not for static
  environment probes that need no task knowledge (those fit a SessionStart hook), and not yet
  implemented or measured, so the split of responsibilities and the cost are unverified.
tags: [claude-code, multi-agent, workflow]
keywords: [wip, 初期化エージェント, preflight, 事前確認, 環境確認, plan モード, 計画, サブエージェント, fan-out, ビルド, テスト, pnpm check, worktree, node_modules, .venv, 手順書, wip/local, ユーザに確認, 副作用, command not found]
status: stable
sources:
  - https://code.claude.com/docs/en/sub-agents
  - https://code.claude.com/docs/en/hooks
---

# 計画の直後に初期化サブエージェントを走らせてコマンドの動作確認と手順書を作らせるとよいはず

## 思いつき

複数のサブエージェントに仕事を散らすと、同じ環境不備 (コマンドが無い、パスが Windows で違う、
worktree に `node_modules` が無い) を全員が別々に踏む。サブエージェントは既定で背景で走るので失敗は見えにくく、
気づいたときには各自がその場しのぎの回避策をコンテキストに積んでいる。

これを防ぐために、Claude Code の主エージェントが plan モードで全体計画をだいたい立てた直後、
仕事を散らす前に 1 回だけ「初期化サブエージェント」を走らせる。

1. 計画に含まれるタスクをすべて読み、ビルド・テスト・git・シェルで実行する想定のコマンドを抜き出す
2. それぞれがこの環境で実際に動くか確かめる。plan が worktree を使うなら、その worktree 側でも同じことを確かめる
3. 開発タスクならテスト実行などのスクリプトをここで作る。各サブエージェントに「どう動かすか」を考えさせず、
   書かれた手順とスクリプトをなぞるだけにする
4. 動いたコマンドと手順を `wip/local/preflight.md` のようなファイルに書く。後続のサブエージェントは主エージェントの
   コンテキストを継がないので、プロンプトでこのファイルを読ませる
5. 動かなかったものは「コマンド、結果、エラー全文、直し方の候補」で構造化して主エージェントに返す

サブエージェントはユーザに直接聞けないので、ユーザへの確認は主エージェントの仕事。未解決分をまとめて
最初に 1 回聞き、答えが出てから散らす。

## 静的な検査は hook に寄せる

タスクを読まなくても分かる検査 (node / pnpm / uv / jq / git / glab / gh の有無とバージョン、`.venv` と `node_modules`
の存在、Windows で `bash` が WSL のスタブに解決されていないか) は LLM を挟む必要がない。
SessionStart の command hook で決め打ちにして additionalContext で注入すれば、主エージェントは最初から知っている。
初期化サブエージェントが担うのは、計画を読まないと決まらないタスク固有の部分だけ。

SessionStart の時点では計画がまだ無いので、タスク固有の検査を hook に書くことはできない。この分担は時系列でも決まる。

## 設計で気をつけること

- 副作用の無い検査 (`--version`、`--help`、`git status`、`pnpm check`) と、成果物を書き換える実行 (`pnpm slides`、
  `pnpm diagrams`) を分ける。後者を preflight で回すと成果物が汚れる
- 「コマンドが無い」と「コマンドはあるが入力のせいで失敗した」を分けて報告させる。テストが本当に落ちているのを
  環境不備と混同すると、ユーザに聞く内容がずれる
- 初期化サブエージェントに環境を直させない。パッケージ導入や PATH の変更はユーザ判断なので、permissions の deny か
  プロンプトで明示して止める
- 並列作業は [git worktree で隔離する](parallel-agents-isolated-by-worktree.md)が、`node_modules` と `.venv` は
  追跡していないので新しい worktree には無い。主 worktree だけで preflight を通しても意味がなく、worktree ごとに
  `pnpm install` と `uv sync` を通すか、worktree 作成の手順に組み込む。ここが一番効くはず
- 作るスクリプトは[黙って成功しない](../skills/scripts/agent-scripts-must-not-succeed-silently.md)ようにする

## 関連

- [サブエージェントは既定で background で走る](subagent-runs-in-background-by-default.md)。失敗が見えにくい理由
- [文脈を持たない監査サブエージェント](context-free-audit-subagent-on-tool-count.md)。あちらは走行中の逸脱を見る役、こちらは走る前の環境を見る役
- [Windows では hook の bash が WSL のスタブに解決される](../hooks/common/bash-hook-resolves-to-wsl-stub-on-windows.md)。静的検査で拾いたい典型
- [ガード・誘導・自動化の 3 機構](../hooks/common/guard-steer-automate-mechanisms.md)。hook 側は自動化、手順書は誘導、直させない制約はガード

## 確かめていないこと

- plan モードで作った計画をサブエージェントにどう渡すか (計画ファイルの場所と形式)
- 「コマンド」をどこまで抜き出すか。計画に書かれていない暗黙のコマンド (lint、フォーマッタ) を拾えるか
- 手順書を読ませるだけで後続のサブエージェントのエラーが実際に減るか、減るとしてどのくらいか
- 初期化サブエージェント 1 回分のトークンと時間が、各サブエージェントの手戻りより安いか
- worktree ごとの `pnpm install` をどこに組み込むのがよいか (初期化サブエージェント、EnterWorktree の直後、WorktreeCreate hook)

## 昇格の目安

(.claude/rules/knowledge-authoring.md「note を昇格させる」)。満たしたら type を変える。ファイルは動かさない。

- [ ] 粒度が type の定義に収まっている (pattern になる見込み)
- [ ] sources に一次情報がある
- [ ] 実際に試して applies_to と verified_at を書ける
