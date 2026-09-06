---
type: concept
nature: fact
title: Messages API は stateless で毎ターン会話全文を送り直している
description: >-
  Beginner-level explanation of the Claude Messages API for people who know systems but not LLM APIs.
  The server keeps no conversation state, so every request carries the whole messages array again, which
  is why a long chat costs more per turn even when the new question is short, and why prompt caching
  exists. Also covers the agent-facing parts of the response (stop_reason values, tool_use and
  tool_result blocks, the usage token fields). Use when explaining why long sessions get expensive,
  budgeting an agent, or writing a conversation loop by hand. Not for Claude Code specific behaviour
  such as auto-compaction, and not for SDK syntax in any one language.
tags: [claude-api, context-management, cost, tool-use]
keywords:
  - Messages API
  - stateless
  - ステートレス
  - messages 配列
  - 会話履歴の再送
  - 入力トークン
  - 二乗
  - 料金が上がる
  - prompt caching
  - プロンプトキャッシュ
  - cache_read_input_tokens
  - cache_creation_input_tokens
  - TTL
  - stop_reason
  - end_turn
  - tool_use
  - max_tokens
  - refusal
  - usage
status: stable
verified_at: 2026-09-06
stale_after: 2027-03-06
applies_to: [claude-api@2026-09]
sources:
  - https://platform.claude.com/docs/en/api/messages
  - https://platform.claude.com/docs/en/build-with-claude/prompt-caching
  - https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons
  - https://platform.claude.com/docs/en/about-claude/pricing
---

# Messages API は stateless で毎ターン会話全文を送り直している

## 要点

Claude の Messages API にはセッションが無い。サーバは前回何を話したかを覚えていないので、
**会話を続けるとは、これまでのやりとり全部をもう一度リクエストに詰めて送ることである**。
だからチャットが長くなるほど 1 回あたりの入力トークンが増え、同じ質問でも後になるほど高くつく。

## 仕組み

### リクエストの形

エンドポイントは `POST /v1/messages` の 1 つだけで、ツールも構造化出力もこの 1 つのパラメータ違いでしかない。

```json
{
  "model": "claude-opus-5",
  "max_tokens": 16000,
  "system": "あなたはコードレビュアです",
  "tools": [ ... ],
  "messages": [
    { "role": "user",      "content": "この関数のバグは?" },
    { "role": "assistant", "content": "null チェックが抜けています" },
    { "role": "user",      "content": "直して" }
  ]
}
```

`messages` が会話そのもの。最初は必ず `user` で始める。**この配列を組み立てて保持するのはクライアント側の責任**であって、
サーバに「会話 ID」を渡して続きを頼む仕組みではない。HTTP のセッションレス API を触ったことがあるなら、
Cookie もセッションストアも無い API だと思えばよい。

### 会話が伸びると入力トークンが二乗で効く

3 往復目には 1 往復目と 2 往復目の内容も全部載っている。仮に 1 往復ごとに 1,000 トークン増える会話なら、こうなる。

| 往復 | そのリクエストの入力トークン | ここまでに払った入力トークンの累計 |
|---|---|---|
| 1 | 1,000 | 1,000 |
| 2 | 2,000 | 3,000 |
| 3 | 3,000 | 6,000 |
| 10 | 10,000 | 55,000 |

払う総量は往復回数の**二乗**に比例して増える。「短い質問を 1 つ足しただけなのに高い」と感じるのはこれが理由で、
足したのは質問の分だけでも、その質問と一緒に会話全文がもう一度課金対象になっている。

### prompt caching は「量」ではなく「単価」を下げる

会話の先頭は往復をまたいで変わらないので、そこをサーバ側に置いておいて安く読み直せるのが prompt caching。
重要なのは**送るトークンの量は減らない**ということで、減るのは単価だけ。

- **前方一致で効く。** リクエストは `tools` → `system` → `messages` の順に組み立てられ、先頭から一致する範囲だけがキャッシュされる。
  途中を 1 バイトでも書き換えると、それ以降は全部キャッシュが効かなくなる。**会話配列は追記だけにする**のが鉄則
- **単価の目安**は公式ドキュメントで、キャッシュへの書き込みが通常の約 1.25 倍、キャッシュからの読み出しが約 0.1 倍。
  既定の TTL は 5 分で、`cache_control` に `"ttl": "1h"` を指定すれば 1 時間になる
- **効いているかは応答の `usage` で確かめる。** `cache_read_input_tokens` がゼロのままなら、
  system プロンプトに現在時刻や UUID を入れているなど、毎回キャッシュを壊す原因がどこかにある

| `usage` のフィールド | 意味 |
|---|---|
| `input_tokens` | キャッシュが効かず通常単価で課金された入力 |
| `cache_creation_input_tokens` | キャッシュに書いた入力 (通常より少し高い) |
| `cache_read_input_tokens` | キャッシュから読んだ入力 (通常よりかなり安い) |
| `output_tokens` | 生成された出力。思考トークンもここに含まれる |

### エージェント向けの仕掛けは応答側にある

stateless なのにツール実行を挟んで会話が続けられるのは、**なぜ生成を止めたか**を応答が返し、
続きの組み立てをクライアントに任せているから。それが `stop_reason` で、値ごとに次に何をすべきかが決まる。

| `stop_reason` | 意味 | クライアントがすること |
|---|---|---|
| `end_turn` | 言い終わった | ユーザに返す |
| `tool_use` | ツールを呼びたい | ツールを実行し、結果を `tool_result` にして送り直す |
| `max_tokens` | `max_tokens` の上限で切れた | 上限を上げるかストリーミングにする |
| `stop_sequence` | 指定した停止文字列に当たった | 用途次第 |
| `pause_turn` | 長い処理の途中で一旦止まった | そのまま送り直して再開する |
| `refusal` | 安全性の判断で断った | `stop_details` の分類を見る |

`tool_use` のとき応答には呼ぶツール名と引数が入った `tool_use` ブロックが入り、実行するのはクライアント。
結果は次の `user` メッセージの `tool_result` ブロックとして会話に足す。
つまり**ツールの往復も会話履歴として積み上がる**ので、上の二乗の話がそのまま当てはまる
([Claude Code の 1 ターンは end_turn まで回る tool use ループである](turn-is-a-tool-use-loop-until-end-turn.md))。

## 使いどころ

- **長いセッションが高い理由を説明するとき。** 原因は「たくさん質問したから」ではなく「1 往復ごとに全文を送り直しているから」。
  だから話題が変わったら会話を捨てる (`/clear` のような操作) のが、いちばん素直な節約になる
- **エージェントの費用を見積もるとき。** 見るのは往復回数ではなく「往復回数 × その時点の会話長」。ツールの出力が大きいほど後の全往復に効いてくる
- **自分で会話ループを書くとき。** 会話配列は追記だけにし、system プロンプトとツール定義は固定する。
  途中を書き換える実装にすると、動きはするがキャッシュが毎回壊れて費用だけ膨らむ

そうでない場合もある。API 側には履歴をサーバで要約する compaction (beta) と、Anthropic がループも状態も持つ Managed Agents があり、
どちらも状態をサーバに預ける。ただし **Claude Code はそのどちらも使っていない**。Claude Code の `/compact` は
自分でモデルに要約を書かせ、送る `messages` 配列をローカルで組み直している
([Claude Code の compact はモデルへ送る会話を要約 1 通と直近数通に組み直す](compact-rebuilds-the-sent-conversation-as-a-summary.md))。
Claude Code を使っている限り、ここに書いた stateless の話はそのまま当てはまると考えてよい。

なお、ここに書いた単価の倍率と TTL は公式ドキュメントの値で、手元で API を直接叩いて計測したものではない。

## 関連

- [Claude Code の 1 ターンは end_turn まで回る tool use ループである](turn-is-a-tool-use-loop-until-end-turn.md) — この API の上に Claude Code がどう乗っているか
- [Claude Code の機能が分かれているのは context を守るため](features-split-to-protect-the-context-window.md) — 二乗で効く入力への対策側
- [context が増えると質が落ち始める閾値は 40% から 400k トークンまで諸説ある](../model/context-quality-drop-thresholds-vary-by-source.md) — 費用ではなく品質の側
