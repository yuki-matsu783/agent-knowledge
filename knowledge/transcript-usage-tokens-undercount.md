---
type: pitfall
title: transcript の usage トークンは過小に記録されることがある
description: >-
  Explains why token counts summed from the Claude Code transcript JSONL (`message.usage` on assistant lines)
  can be far below what the API actually billed: the line is written at the start of a streaming response with
  placeholder values (0 or 1) for input_tokens and output_tokens and is not always updated afterwards, while the
  cache fields settle early and stay close to correct. Use when a usage report built from transcript_path shows
  implausibly small input numbers, or when deciding whether to compute a USD estimate from the JSONL. Not for
  the OpenTelemetry metrics, which come from the API response, and not a way to recover the true count after
  the fact.
tags: [claude-code, cost, observability]
keywords: [usage, input_tokens, output_tokens, 過小カウント, undercount, プレースホルダ, streaming, transcript, JSONL, cache_read_input_tokens, cache_creation_input_tokens, 対応工数, コスト算出, 目安]
status: stable
sources:
  - https://gille.ai/en/blog/claude-code-jsonl-logs-undercount-tokens/
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# transcript の usage トークンは過小に記録されることがある

## 症状

transcript の assistant 行の `message.usage` を足し上げた集計が、実際の請求と桁で食い違う。外部調査の報告では
input 側で最大 100〜174 倍、output 側で最大 10〜17 倍の過小カウントが観測されている。
値はパースできるので、集計処理はエラーを出さずに小さすぎる数字を返す。

## 原因

transcript の行はストリーミング応答の開始時点で書かれ、そのとき `usage.input_tokens` 等にはプレースホルダ値 (0 または 1) が入る。
応答完了後にその値が実際のトークン数へ更新されないケースがある。キャッシュ関連のフィールド (`cache_read_input_tokens`
`cache_creation_input_tokens`) は API レスポンスの初期段階で確定するため影響を受けにくい。

## 回避策

- **金額 (USD) を算出しない。** モデル単価表を自前で保守する手間に加え、この過小カウントで請求額と大きくずれる。トークン数の生の値だけを出す
- **レポート本文に「目安として扱ってください」と明記する。** 「失敗を握りつぶす」設計はプレースホルダ値には効かない (パースは成功する) ので、利用者への明示が実質的な対策になる
- 稼働時間のような `timestamp` の差分だけで計算できる指標は影響を受けない。トークン以外の指標を併記すると読み手が補正できる
- 正確な値が要るなら transcript ではなく OpenTelemetry のメトリクス ([observability-layer-for-claude-code.md](observability-layer-for-claude-code.md)) を使う

## 再現条件

元リポジトリの対応工数レポート (transcript 自前パース) で採用していた前提が、外部調査の報告によって「結果的に同じ形で対応できていた」と確認された。
Claude Code のバージョンは記録されていない。JSONL は非公開フォーマットで、将来の版で挙動が変わりうる。

## 関連

- [Claude Code の transcript JSONL は /compact を挟んでも追記専用である](transcript-jsonl-is-append-only-across-compact.md)
- [Claude Code の実行を観測する層を後付けで入れる](observability-layer-for-claude-code.md)
