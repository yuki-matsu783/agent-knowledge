---
type: concept
nature: fact
title: Claude Code の transcript JSONL は /compact を挟んでも追記専用である
description: >-
  Explains the structure of the Claude Code session transcript (~/.claude/projects/<project>/<sessionId>.jsonl):
  it is append-only, /compact only appends a `compact_boundary` system line and an `isCompactSummary` user
  line without deleting earlier lines, every assistant line carries `message.usage`, `message.model` and the
  `gitBranch` that was checked out at the time, and a snapshot taken at push N is byte-identical to the first
  N lines of the live file. Use when building usage reports, push-time log archives, or any tool that reads the
  transcript incrementally and needs to know what a line-count cursor means. Not for the OpenTelemetry
  exporter, which is a separate data source, and not a stable format: Anthropic documents the JSONL as
  internal and subject to change.
tags: [claude-code, observability, context-management]
keywords: [transcript, JSONL, transcript_path, compact_boundary, isCompactSummary, 追記専用, append-only, gitBranch, message.usage, preTokens, postTokens, セッションログ, ~/.claude/projects, 行カーソル, スナップショット]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# Claude Code の transcript JSONL は /compact を挟んでも追記専用である

## 要点

セッションの transcript (`~/.claude/projects/<project>/<sessionId>.jsonl`) は追記しか起きないファイルで、
`/compact` も行を消さない。「push した時点のログ」は「現物の先頭 N 行」と等しいので、断面ごとの全文コピーは要らず、
行番号を 2 つ記録すれば足りる。hook が受け取る `transcript_path` はこのファイルを指す。

## 仕組み

### 行の種類と持っている情報

| 行 | 主なフィールド | 使いどころ |
|---|---|---|
| `type: assistant` | `message.usage` (`input_tokens` / `output_tokens` / `cache_creation_input_tokens` / `cache_read_input_tokens`)、`message.model`、`gitBranch`、`timestamp`、`uuid` / `parentUuid` | トークン集計、ブランチ別の絞り込み |
| `type: user` | `message.content` (配列**または文字列**)、`isCompactSummary` | ツール結果、人間の入力、圧縮要約 |
| `type: system` `subtype: compact_boundary` | `compactMetadata.trigger` (`manual` / `auto`)、`preTokens`、`postTokens` | 圧縮が起きた位置 |

`gitBranch` は全 assistant 行に付く (元リポジトリの実データで付与率 100%)。同じセッションで複数ブランチを跨いだとき、
これで絞らないと他ブランチ分のトークンが混入する。実例では無関係な旧ブランチ分が 45 万トークン混ざっていた。

hook のペイロード (`Stop` / `PostToolUse` 等) にトークン数やコストは**含まれない**。含まれるのは `session_id` `transcript_path`
`cwd` `tool_name` などの共通フィールドだけで、使用量を知るには transcript を読むしかない。`claude -p --output-format json` は
`total_cost_usd` を返すが、それは新しく起動した非対話セッションの結果であって進行中のセッションのものではない。

### /compact は追記するだけ

`/compact` を実行したセッションの transcript を調べると、境界行と要約行が末尾へ足されるだけで、それより前の行はそのまま残る。

```jsonl
{"type":"system","subtype":"compact_boundary","content":"Conversation compacted",
 "compactMetadata":{"trigger":"manual","preTokens":251995,"postTokens":15679,"cumulativeDroppedTokens":236316}}
{"type":"user","message":{...},"isCompactSummary":true}
```

`preTokens → postTokens` は「次回以降モデルへ送るコンテキスト」の圧縮量で、ディスク上のファイルは縮まない。
圧縮境界より前の位置で取った断面が、圧縮後の現物とも完全一致することが確かめられている。

### 断面は先頭 N 行と一致する

同じセッションの push 断面 5 つ (253 行〜698 行) を現物の先頭 N 行とバイト単位で比べて、すべて一致した。
したがって push ごとにログを保存する仕組みは「セッションにつきミラー 1 本 + push ごとの行範囲」で表現でき、
ローカル状態が push 回数に比例して増えなくなる (実例で 23MB + 13MB が 1 本分に縮んだ)。

行番号を「空行を除いた行数」で数える集計と、物理行で切る `sed -n 'N,Mp'` を混ぜると空行 1 つでずれる。基準を 1 つに決めておく。

## 使いどころ

- 対応工数レポートのように「前回 push からの差分」を集計する処理。前回までに読んだ行数をセッション単位で記録し、以降の行だけを足す
- push 時のログ保存。全文コピーではなく行範囲のインデックスにする
- ただし `~/.claude/projects` はユーザープロファイル配下の非公開パスで、ローテーションや形式変更で失われうる。
  集計処理が直接依存し続けるのを避けるなら、リポジトリ内の gitignore 対象ディレクトリへミラーしてから読む

効かない場面もある。フォーマットは非公開で将来変わりうるので、パースは 1 行ごとに失敗を握りつぶし、
集計は「目安」と明記する。使用量の値自体にも落とし穴がある ([transcript-usage-tokens-undercount.md](transcript-usage-tokens-undercount.md))。

## 関連

- [transcript の usage トークンは過小に記録されることがある](transcript-usage-tokens-undercount.md)
- [resume すると transcript の行が別ブランチ名で再書き出しされる](transcript-lines-duplicated-on-resume.md)
- [user 行の message.content は配列とは限らない](transcript-user-content-may-be-string.md)
- [Claude Code の実行を観測する層を後付けで入れる](observability-layer-for-claude-code.md)。4 つの観測源のうち JSONL の詳細がこの知識
- [compact 後に SessionStart hook で作業コンテキストを再注入する](../rule/reinject-work-context-after-compact.md)。compact が消すのはモデルへ送る側で、ファイル側ではない
