---
type: pattern
nature: best-practice
title: 敵対的レビューは独立コンテキストの読み取り専用サブエージェントに切り出すべき
description: >-
  An implemented Claude Code pattern for reviewing an agent's own work without the author's bias: a custom
  subagent with Read/Grep/Glob/Bash only and a stronger model receives just the diff or file list, a merged
  review checklist, and the phase, is forbidden to read git log or the design rationale, and returns findings
  JSON that the caller posts after one up-front approval; run count per phase is capped by a script, not by
  the agent's restraint, and in interactive sessions the agent may propose but never start it. Use when
  self-review keeps rationalizing defects, especially "silently swallowed" ones that never error. Not a
  replacement for the built-in /code-review, which finds code bugs but has no hook for repository
  conventions, and not for autonomous loops without a human review in between.
tags: [claude-code, multi-agent, evaluation]
keywords: [敵対的レビュー, adversarial review, サブエージェント, 独立コンテキスト, 読み取り専用, 経緯を渡さない, git log 禁止, findings JSON, 承認は 1 回, 回数上限, スクリプトで強制, model opus, 自律起動禁止, 無言で消える欠陥, 自己レビュー, 追認]
status: stable
sources:
  - https://code.claude.com/docs/en/sub-agents
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: tool
---

# 敵対的レビューは独立コンテキストの読み取り専用サブエージェントに切り出すべき

## 課題

エージェント自身に成果物を確認させると、**自分が書いたものを自分で読み返す構図では追認する方向へ働く**。実装の意図を知っている以上、
「そう書いた理由があるはずだ」という補完が入り、独立した検証にならない。組み込みの `/code-review` はコードの正しさを見る汎用レビューで、
リポジトリ固有の落とし穴 (計画の粒度、仕様と決定記録の二重管理、過去記録の書き換え、shell の既知の罠) を観点として持たせる口が無い。

## 解決

1. **読み取り専用の専任サブエージェント** (`.claude/agents/adversarial-reviewer.md`)。ツールは Read / Grep / Glob / Bash のみで Write / Edit を持たせない。
   モデルは強い方 (`opus`)。「書かれていないことを欠落として見つける」役割で、情報を集めて報告するだけの補助エージェントとは要求される推論の深さが違う
2. **渡すのは 3 つだけ**: レビュー対象 (diff かファイルパス一覧)、マージ済みの観点表、フェーズと対象の種別。**「なぜそう実装したか」の経緯は渡さない。**
   `git log` でコミットメッセージや過去の議論を読むことも、観点表を自分で探しに行くことも禁じる。対象範囲の判断は呼び出し元の 1 箇所へ寄せる
3. **findings JSON を返すだけで投稿しない。** 投稿は呼び出し元 skill の責務にし、承認の所在を 1 箇所へ集約する
4. **投稿の可否はレビュー実行の前に 1 回だけ確認する。** 指摘ごとの個別承認は求めない。GitHub の提出済みレビューは削除できないので
   「投稿してから取り消す」前提の設計はできず、承認を細かくしても取り返しがつくわけではない。誤検知の抑制は確度と重大度による振り分けで行う
5. **対話セッションではエージェントからの自律起動を禁止する。** 持ちかけるのは構わないが返事を待たずに実行しない。非対話セッションでのみ自律起動を許す。
   非対話かどうかは環境変数 (誰も設定しない) ではなくエージェントが実行環境の性質から判断し、迷ったら「動かない」側へ倒す
6. **実施回数は各フェーズ最大 3 回とし、スクリプトで強制する。** 非対話では「レビュー → 修正 → 再レビュー」が人間の介在なく回りうるので、
   エージェント自身が守るルールでは歯止めにならない。緩める口は用意しない
7. 全体フローの必須ステップにしない。サブエージェント起動のコストを誤字修正にまで払わせない

## 適用条件

- 効く: 「エラーにならず注記だけが黙って消える」型の欠陥。実例では frontmatter 読み取りの取りこぼし 4 件 (末尾空白、行内コメント、UTF-8 BOM、複数行スカラー)、
  hook 前置フィルタの超集合破れ 2 件、コマンド判定の機能後退 2 件が、いずれも実装者の自己確認では拾えず敵対的レビューで見つかった。
  「新しい手順を足したとき、同じファイルの禁止事項が古くなっている」矛盾も指摘された
- 効かない: 人間のレビューの代替。投稿と返信の間に人間のレビューを挟み、人間が同じスレッドで判断を示す余地を残す

## トレードオフ

- 得る: 実装者の文脈が無い視点。`/code-review` で拾えるバグはこちらでも拾えるが逆は成り立たないので、併用は推奨
- 失う: 実行時間とトークン。誤検知はゼロにならない
- AI が投稿した指摘にも、人間の指摘と同列に返信を必須にする。自分で直したから自明、は MR を読む人間には「対応済み」と「見落とし」の区別が付かない

## 関連

- [ツール使用回数を閾値にして、文脈を持たない監査サブエージェントを背景で走らせる](context-free-audit-subagent-on-tool-count.md)。同じ発想の未検証 note。こちらは実装して運用した形
- [rules を固定フォーマットの唯一の正にし、レビューは関心事ごとのサブエージェントが横断的に読む](../rules/rules-as-single-source-for-authoring-and-review.md)。何を観点として渡すかの案
- [レビューエージェントは判定せず確度と重大度を付けた findings を返し、閾値と投稿は呼び出し側が持つ](reviewer-scores-findings-caller-applies-threshold.md)。手順 3〜4 の出力の受け渡しを pattern として切り出したもの
- [エージェントからインラインレビューコメントを投稿するときのプロバイダ制約](../workflow/inline-review-comment-provider-constraints.md)。findings を投稿する側の制約
- [サブエージェントのモデルは定義で固定せず呼び出し側に決めさせる](subagent-model-selection-by-orchestrator.md)。レビュー用は例外として強いモデルを固定する判断
- [hook の前置フィルタは精密判定の超集合でなければ生 JSON のエスケープで穴が開く](../hooks/20-PreToolUse/hook-prefilter-must-stay-superset.md)。このレビューで見つかった反例
