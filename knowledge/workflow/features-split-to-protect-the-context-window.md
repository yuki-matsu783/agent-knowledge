---
type: concept
nature: insight
title: Claude Code の機能が分かれているのは context を守るため
description: >-
  Explains that Claude Code's separate features (subagents, on-demand skill loading, deferred MCP tool
  definitions, hook preprocessing, auto-compaction, code intelligence plugins) are all answers to the
  same question of what must be kept out of the context window, and pairs each context consumer with the
  feature that counters it. Use when choosing between a skill, a subagent, a hook, and a CLAUDE.md entry
  for the same job, or when explaining why a long session degrades. Not a threshold for when quality
  drops, and not a guide to writing any one of those features.
tags: [claude-code, context-management, cost]
keywords:
  - コンテキストウィンドウ
  - context window
  - auto-compaction
  - 自動圧縮
  - /clear
  - /compact
  - /context
  - サブエージェント
  - skill のオンデマンド読み込み
  - MCP ツール定義
  - Tool Search
  - deferred
  - ツール結果
  - CLAUDE.md 200 行
  - 設計思想
status: stable
verified_at: 2026-09-06
stale_after: 2027-03-06
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/costs
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/sub-agents
  - https://code.claude.com/docs/en/mcp
  - https://zenn.dev/boku_yaji/articles/6f549c712b40cd
---

# Claude Code の機能が分かれているのは context を守るため

## 要点

Claude Code の機能はばらばらに足されたものではなく、どれも「何を context に載せないか」という同じ問いへの答えになっている。
[1 ターンが tool use のループである](turn-is-a-tool-use-loop-until-end-turn.md)以上、往復のたびに会話全文が再送されて context は必ず伸びる。
だから機能の選択は「どれが便利か」ではなく「何を context の外に出せるか」で決まる。

## 仕組み

### 消費するものと、それを打ち消す機能

| context を消費するもの | いつ載るか | 打ち消す機能 |
|---|---|---|
| ツール結果 (Read、Bash の出力、テストログ) | 往復ごとに積み上がる。最大の消費源 | サブエージェントへの委譲、hook による前処理、auto-compaction |
| 会話履歴そのもの | 常時。往復ごとに全文が再送される | `/clear`、`/compact`、auto-compaction |
| CLAUDE.md と `paths` 無しの rules | 毎セッション全文 | 200 行以下に保ち、詳細は skill へ移す |
| skill 本文 | 呼び出したときだけ | オンデマンド読み込み。常時載るのは description だけ |
| MCP ツール定義 | 既定では名前と server instructions だけ | ツール定義の遅延読み込み (Tool Search)。使うときに定義を取る |
| 不慣れなコードの探索 | 探索した分だけ | code intelligence plugin による記号ジャンプ |

同じ仕事に対して置き場所が複数あるとき、選ぶ基準はこの表になる。たとえば「PR レビューの手順」は CLAUDE.md に書けば毎セッション全文が載るが、
skill にすれば呼んだときだけ載る。「テストの失敗だけ見たい」は本文で指示すれば毎回モデルが判断するが、
hook で grep すれば数万トークンが数百トークンになる。

### サブエージェントは context を分けるがトークンは減らさない

サブエージェントは空の context で起動し、結果の要約だけを親に返して自分の context を捨てる。親の context は汚れない。
ただし**払うトークンは減らない**。子は子で自分の context を持ち、CLAUDE.md も skill も MCP も自分で読み込む。
公式ドキュメントは agent teams が plan mode で標準セッションの約 7 倍のトークンを使うと書いている。
context を守るための機能であって、コストを下げるための機能ではない
([サブエージェントのモデルは呼ぶ側が選ぶ](../agents/subagent-model-selection-by-orchestrator.md))。

### MCP ツール定義は既定で遅延読み込みになっている

参照した記事は「ツール定義が context の 10% を超えると Tool Search に切り替わる」と書いているが、
2.1 の公式ドキュメントでは**既定で deferred** になっており、ツール名と server instructions だけが載り、
実際に使うときに定義を取りに行く。閾値で切り替わる挙動ではない。版で変わったところなので、この節は確かめ直す対象にする。

CLI で済むものは MCP より context 効率がよい、という点は変わらない。`gh` や `glab` はツール一覧そのものを持たないので、
1 件も定義が載らない ([MCP のツール名はサーバが決める](../mcp/mcp-tool-names-are-server-defined.md))。

## 使いどころ

- **同じ内容をどこに置くか迷ったとき。** 「毎回要るか」で CLAUDE.md と skill を分け、「無視されて困るか」でさらに hook を検討する
  ([CLAUDE.md は最小から始めて外したときだけ足す](../rules/claude-md-starts-minimal-and-grows-only-on-misses.md))
- **長いセッションで質が落ちてきたとき。** 圧縮より先にタスクを切る。compact 自体が会話全文を読む大きなリクエストになる
  ([タスクの切れ目で /compact と /clear をユーザに依頼させる](../hooks/22-PostToolUse/ask-user-to-reset-context-at-task-boundaries.md))
- **冗長な出力を出すコマンドを見つけたとき。** そのコマンドを叩く前に絞る hook を置くのが、指示で「全部読むな」と書くより効く

効かない場面もある。context を空けても、失敗した手の記録まで消えると同じ失敗を繰り返す。
消していい情報と外へ逃がす情報は分ける ([失敗した手はチケットの Do-Not-Repeat 節に残す](keep-do-not-repeat-list-outside-context.md))。

## 関連

- [Claude Code の 1 ターンは end_turn まで回る tool use ループである](turn-is-a-tool-use-loop-until-end-turn.md) — context が伸びる側の仕組み
- [context が増えると質が落ち始める閾値は 40% から 400k トークンまで諸説ある](../model/context-quality-drop-thresholds-vary-by-source.md)
- [context 使用率は hook 入力に無いので statusLine から状態ファイル経由で hook に渡す](../hooks/common/statusline-as-context-usage-sensor-for-hooks.md)
- [skill の description は 1,536 字で切られる](../skills/skill-description-cut-by-listing-budget.md)
- [compact 後は SessionStart hook で作業コンテキストを再注入する](../hooks/00-SessionStart/reinject-work-context-after-compact.md)
- [context が伸びるほど指示が効かなくなるのは注意が全トークンに配られるから](../model/attention-dilutes-as-context-grows.md) — なぜ context を守る必要があるのかのモデル側の理由
