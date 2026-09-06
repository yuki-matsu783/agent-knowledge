---
type: reference
nature: fact
title: transcript の usage は API 応答 1 回分の値が全行に複製されたものである
description: >-
  Field-by-field reference for `message.usage` on Claude Code transcript assistant lines, and the counting
  rule that follows from it: one API response becomes several assistant lines (one per content block),
  every one of those lines carries an identical copy of the same usage object, so summing per line
  overcounts output tokens roughly threefold. Explains what each key means (input_tokens vs the two cache
  fields, thinking_tokens as a subset of output_tokens, cache_creation ephemeral tiers, iterations,
  service_tier, server_tool_use) and why input_tokens alone is a tiny fraction of the real prompt under
  prompt caching. Use when building a usage or cost report over `transcript_path`, or when totals look
  implausibly large or small. Not for the OpenTelemetry metrics, which are a separate source.
tags: [claude-code, cost, observability]
keywords: [usage, message.usage, requestId, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, thinking_tokens, output_tokens_details, cache_creation, ephemeral_1h_input_tokens, iterations, service_tier, server_tool_use, apiBlockIndex, 二重計上, 重複, トークン集計, プロンプトキャッシュ]
status: stable
verified_at: 2026-09-06
stale_after: 2027-03-06
applies_to: [claude-code@2.1]
sources:
  - https://docs.claude.com/en/api/messages
  - knowledge/workflow/transcript-line-types-and-what-writes-them.md
---

# transcript の usage は API 応答 1 回分の値が全行に複製されたものである

## 対象

Claude Code の transcript で `type: assistant` の行に付く `message.usage` の中身と、その数え方。
`version` 2.1.232〜2.1.261 の VS Code 拡張で確かめた。割合は 24,000 回を超える API 応答の実測。

`usage` が付くのは `assistant` 行だけで、`user` 行にも状態の行にも付かない
([行の種類の全体像](transcript-line-types-and-what-writes-them.md))。

## サンプル

実物をそのまま載せる。この 1 個で 1 回の API 応答を表す。

```json
{
  "input_tokens": 2,
  "cache_creation_input_tokens": 20818,
  "cache_read_input_tokens": 29767,
  "output_tokens": 286,
  "output_tokens_details": { "thinking_tokens": 0 },
  "cache_creation": {
    "ephemeral_1h_input_tokens": 20818,
    "ephemeral_5m_input_tokens": 0
  },
  "server_tool_use": { "web_search_requests": 0, "web_fetch_requests": 0 },
  "service_tier": "standard",
  "speed": "standard",
  "inference_geo": "not_available",
  "iterations": [
    { "type": "message", "input_tokens": 2, "output_tokens": 286,
      "cache_read_input_tokens": 29767, "cache_creation_input_tokens": 20818,
      "cache_creation": { "ephemeral_1h_input_tokens": 20818, "ephemeral_5m_input_tokens": 0 } }
  ]
}
```

**この応答が実際にモデルへ送った入力は 2 トークンではない。** 入力側は 3 つに割れていて、合計は
`2 + 20818 + 29767 = 50,587` トークン。`input_tokens` はそのうちキャッシュに載らなかった分でしかない。

## 一覧

| キー | 意味 | 注意 |
|---|---|---|
| `input_tokens` | キャッシュを使わずに送った入力 | プロンプトキャッシュが効いていると極端に小さい。実測では 9 割超の応答で 5 以下 |
| `cache_creation_input_tokens` | 今回キャッシュへ書いた入力 | 課金上は通常の入力より高い |
| `cache_read_input_tokens` | キャッシュから読んだ入力 | 入力側の実体はほぼこれ。実測で最大 949,115 |
| `output_tokens` | 生成した出力 | 下の `thinking_tokens` を**含む** |
| `output_tokens_details.thinking_tokens` | そのうち thinking の分 | `output_tokens` の内訳。実測で出力全体の約 3 割。`output_tokens` を超えた例は無い |
| `cache_creation.ephemeral_1h_input_tokens` | 1 時間 TTL で書いたキャッシュ | 実測ではキャッシュ書き込みは全部こちら |
| `cache_creation.ephemeral_5m_input_tokens` | 5 分 TTL で書いたキャッシュ | 実測では常に 0 |
| `server_tool_use.web_search_requests` | サーバ側 Web 検索の回数 | トークンではなく回数 |
| `server_tool_use.web_fetch_requests` | サーバ側 Web 取得の回数 | 同上 |
| `service_tier` | `standard` など | 実測では `standard` のみ |
| `speed` | `standard` など | 実測では `standard` のみ |
| `inference_geo` | 推論を行った地域 | 実測では `not_available` のみ |
| `iterations[]` | 応答内の内訳 | 実測では要素 1 個で、中身は上位の値と同じ。冗長なので足し込まない |

`input_tokens` `cache_creation_input_tokens` `cache_read_input_tokens` `output_tokens` `cache_creation`
`service_tier` `inference_geo` は全応答に付く。`iterations` `output_tokens_details` `server_tool_use` `speed` は
ごく一部 (エラーで終わった応答など) で欠ける。**欠けを 0 として扱う。**

## 補足

### 同じ usage が複数行に複製される

**これが一番踏みやすい。** 1 回の API 応答は、content block ごとに複数の `assistant` 行へ分かれて書かれる。
`text` と `tool_use` が 1 回の応答に入っていれば 2 行になる。そして**どの行にも同じ `usage` が丸ごとコピーされる**。

同じ応答かどうかは `requestId` で分かる。実測では 1 応答あたり平均 2.4 行、最大 15 行以上で、
1 行だけで済む応答は全体の 3 分の 1 しかない。`usage` が行によって違った応答は 24,653 件中 2 件だけだった。

素直に行ごとに足すと、**出力トークンで約 3.1 倍、キャッシュ読み込みで約 2.1 倍に膨らむ**。

```jsonl
{"type":"assistant","requestId":"req_011…","uuid":"c723…",
 "message":{"content":[{"type":"text","text":"読みます"}],
            "usage":{"input_tokens":2,"output_tokens":286,"cache_read_input_tokens":29767, …}}}
{"type":"assistant","requestId":"req_011…","uuid":"4a2d…",
 "message":{"content":[{"type":"tool_use","name":"Read", …}],
            "usage":{"input_tokens":2,"output_tokens":286,"cache_read_input_tokens":29767, …}}}
```

上の 2 行で消費したのは合計 286 出力トークンであって、572 ではない。

正しくは `requestId` で束ねて 1 つだけ採る。

```jq
[ inputs
  | select(.type == "assistant" and .requestId != null)
  | { r: .requestId, u: .message.usage } ]
| group_by(.r) | map(.[0].u)                      # 応答ごとに 1 個だけ残す
| { output:      (map(.output_tokens) | add),
    thinking:    (map(.output_tokens_details.thinking_tokens // 0) | add),
    inputTotal:  (map(.input_tokens
                      + .cache_creation_input_tokens
                      + .cache_read_input_tokens) | add) }
```

`requestId` を持たない `assistant` 行がわずかにある (API エラーの行など)。束ね方の対象外になるので、
数えるなら別枠にする。`apiBlockIndex` も応答内の位置を表すが、付かない行の方が多いので束ねる鍵には使えない。

### 入力トークンはキャッシュの 2 つを足さないと意味がない

`input_tokens` だけを足した値は、入力側の実体の 1 万分の 1 以下になることがある。実測ではプロンプトの
ほとんどがキャッシュ経由で、`cache_read_input_tokens` の総和は `input_tokens` の総和の数千倍あった。

**入力側を見たいなら 3 つを足す。** キャッシュが効いていない最初の応答だけは `cache_read_input_tokens` が 0 になる
(実測で全体の 0.3% 未満)。

これは「usage が小さすぎる」と見える主な理由でもある。桁が合わないときは、まず
`cache_creation_input_tokens` と `cache_read_input_tokens` を足し忘れていないかを見る。
そのうえで別の過小カウントも報告されている
([プレースホルダのまま更新されない件](transcript-usage-tokens-undercount.md))。

### コンテキストの膨らみが見える

1 応答の `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` は、そのとき送ったプロンプト全体の大きさに相当する。
時系列に並べると、会話が伸びてコンテキストが膨らむ様子と、`/compact` で落ちる様子がそのまま出る
([compact は送る側だけを縮める](transcript-jsonl-is-append-only-across-compact.md))。

### USD は出さない

`usage` に金額は入っていない。モデル別の単価表を自前で持てば掛け算はできるが、キャッシュ書き込み・読み込み・
thinking で単価が違ううえ、実請求とずれる。金額が要るなら OpenTelemetry の `cost.usage` を使う
([観測層の比較](observability-layer-for-claude-code.md))。
transcript 側で金額を持つ `cost-state` 行は滅多に書かれない
([行の種類](transcript-line-types-and-what-writes-them.md))。

## 関連

- [Claude Code の transcript は会話・状態・添付の行が混ざった JSONL である](transcript-line-types-and-what-writes-them.md)。`usage` が載る行の位置づけ
- [transcript の usage トークンが過小に記録されていた](transcript-usage-tokens-undercount.md)。足し方を直しても残る限界
- [追記ログの差分集計は行カーソルか id 畳み込みかを再送の有無で選ぶ](append-log-diff-by-cursor-or-fold.md)。増分として数えるときの方式
- [Claude Code の実行を観測する層は後付けで入れられる](observability-layer-for-claude-code.md)。金額と横断集計の入手先
