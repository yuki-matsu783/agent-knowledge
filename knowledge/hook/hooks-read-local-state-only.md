---
type: pattern
nature: principle
title: hook の判定材料はリモートに問い合わせず全実行環境で読めるものだけであるべき
description: >-
  A boundary rule for Claude Code hooks in a git-hosting workflow: hooks judge only from what every
  execution environment (Windows Git Bash, WSL, CI, Claude Code on the web, subagents) can certainly reach,
  namely repository files, local git, and the hook input; they never call gh/glab or an API. Commands the
  agent runs explicitly do the remote work and write the result (PR number, review request ids, undraft) into
  local state that hooks read afterwards; data that must be fresh (unresolved threads, PR open/closed) is
  fetched by those commands, not injected by SessionStart; base-branch drift is checked at start/resume and
  at the final gate, never continuously. Use when a hook would need network or auth. Not for what the
  explicit commands themselves may do remotely.
tags: [claude-code, workflow]
keywords: [hook, リモート, gh, glab, API, 認証, ネットワーク, 全実行環境, Claude Code on the web, WSL, CI, SessionStart, 進行状態, ローカルに記録, 提供コマンド, base ブランチ, behind, 最終ゲート, 常時監視]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
intervention: hook
---

# hook はリモートに問い合わせず全実行環境で読めるものだけを判定材料にする

## 課題

前身のプロジェクトの SessionStart hook は `gh` / `glab` でブランチに紐づく issue / PR の状態を取り、CLI 不在時は MCP フォールバックの案内を注入し、未認証時は失敗メッセージだけを返していた。
後継の要件書の初版も、PR 番号・URL・draft 状態・未返信スレッド数をリモートから取る前提で書かれていた。

想定する実行環境は Windows の Git Bash・WSL・CI・Claude Code on the web・サブエージェントと幅があり、CLI の有無・認証・ネットワークの到達性が環境ごとに違う。
hook はセッション開始やツール呼び出しのたびに**自動で**走り、エージェントが明示的に実行するものではない。環境制約で動かなかったとき、エージェントが自力で復旧する経路が無く、フロー全体が止まる。

## 解決

- **hook の判定・導出の材料は、想定する全実行環境で確実にアクセスできるもの** (リポジトリ内のファイル、git のローカル操作、hook への入力) **に限る。** `gh` / `glab` や API をリモートへ問い合わせない
- **リモートを操作するのはエージェントが明示的に実行する提供コマンド。** その結果 (PR 番号・URL・レビュー依頼と完了の証跡・draft 解除の記録) をその時点でローカルの進行状態に記録し、hook はそれを読む。
  提供コマンドはリモートに到達できず失敗しても、エージェントがその場で対処 (報告、フォールバックへの切り替え) できる。リモートへの依存をそちらに寄せる方が安全側に倒れる
- **リモートの現在値が要る情報** (未返信スレッド数、レビュー判定、PR の open / closed) は hook では扱わず、提供コマンドが取得する
- 基準は「リモートかどうか」ではなく「全環境で確実にアクセスできるか」。全環境で認証済みの CLI が保証される構成になったら、その問い合わせは hook から行ってよい
- 機構の外で作られた PR は「記録なし」として扱い、提供コマンドで紐づけ直す代替経路を持つ
- **base ブランチへの追従は 2 点で確かめる。** 作業の開始・再開時 (fetch と比較だけで、衝突しないが遅れているケースを拾える唯一の安い機会) と、draft 解除の直前 (人間のマージ判断への引き渡し点)。
  PR 作成からマージまでの常時監視は、hook がリモートに問い合わせない原則と両立しない。SessionStart で behind を注入する案も同じ理由で採らず、ローカルの fetch 済み情報だけでは「遅れていない」を保証できず誤った安心を与える

## 適用条件

- 効く: 複数の実行環境で同じ hook 群を配布する構成。hook が失敗するとセッションが止まる拒否側と、静かに誤った情報を注入する案内側の両方
- 効かない: 単一の環境で認証が保証される社内ツール。そこでは hook からの問い合わせが最も新鮮

## トレードオフ

- 得る: 環境制約で hook が止まらない。セッション開始とツール呼び出しのたびに API の往復が走らず、hook が速い。単体テストでリモートを差し替える必要が無い
- 失う: hook が注入する情報は前回の提供コマンド実行時点のもの。「到達できたときだけ問い合わせて失敗したら黙る」案は環境によって注入内容が変わり、再開の手順が環境依存になるので採らない

## 関連

- [ConfigChange と FileChanged に頼ったガードは他のエージェント CLI へ移植できない](hook-event-portability-across-agent-clis.md)。環境差に耐える hook の別の側面
- [失敗メッセージに代替手段を名指しで埋め込む](../mcp/name-the-alternative-in-failure-message.md)。提供コマンドの側が CLI 不在に対処する形
- [merge-tree で作業ツリーを汚さずにベースブランチとの衝突を検知する](../workflow/detect-conflicts-with-merge-tree.md)。最終ゲートの実装
- [compact 後に SessionStart hook で作業コンテキストを再注入する](../rule/reinject-work-context-after-compact.md)。注入する内容をローカルから導く側
