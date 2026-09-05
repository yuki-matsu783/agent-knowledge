---
type: note
title: Claude Code の実行を観測する層を後付けで入れる
description: >-
  Survey of ways to make a Claude Code session observable from the outside, so an operator can tell
  what it is doing, whether it is looping, and where the tokens went. Compares the four data sources
  an external observer can read — the built-in OpenTelemetry exporter, the append-only session JSONL
  under ~/.claude/projects, settings.json hook events, and the terminal surface itself — and records
  the exact telemetry environment variables, metric and event names, and the redaction flags that
  keep prompts and Bash commands out of the collector by default. Use when deciding how to monitor
  cost, tool-call volume, context compaction, or subagent activity across sessions. Not for building
  an approval gate or a permission check, which need hooks and stay in the terminal, and not verified:
  none of the three tools below has been run here.
tags: [claude-code, observability, cost, security]
keywords: [可視化, 観測, ブラックボックス, OpenTelemetry, テレメトリ, トレース, span, Grafana, Jaeger, トークン消費, コスト, 無限ループ, コンテキスト圧縮, compaction, claude-devtools, cmux, JSONL, transcript, レダクション, OTEL_LOG_TOOL_DETAILS]
status: stable
sources:
  - https://code.claude.com/docs/en/monitoring-usage
  - https://qiita.com/nogataka/items/fb28c739d4c4c7f55029
  - https://github.com/matt1398/claude-devtools
  - https://github.com/hummer98/using-cmux
  - https://github.com/hummer98/cmux-team
---

# Claude Code の実行を観測する層を後付けで入れる

## 思いつき

長いセッションは、外から見ると何が起きているか分からない。止めるべきか待つべきかの判断ができない。
出典の記事が挙げる症状は 3 つで、どれも実際に見覚えがある。

- 同じ修正を行き来して抜けない (無限ループ)
- 同じファイルを何度も読み直す
- 気付いたらトークンを大量に使っている

エージェント本体を賢くする話とは別に、**外から観測する層を後付けで入れる**だけで判断材料が増える。
本体に手を入れないので副作用が無く、先に入れておく価値がある。

## データ源は 4 つしかない

外部の観測者が読めるものは次の 4 つに限られる。どのツールもこのどれかの上に乗っている。

| データ源 | 遅延 | 粒度 | 実行への侵襲 | 設定 |
|---|---|---|---|---|
| OpenTelemetry エクスポータ (公式) | 既定でメトリクス 60 秒、ログ 5 秒 | メトリクス・イベント・span (beta) | 無い (別スレッドで送出) | 環境変数のみ |
| セッション JSONL (`~/.claude/projects/`) | 追記の非同期分だけ遅れる | 転写に残るもの全部 | 無い (読むだけ) | 不要 |
| hook イベント (settings.json) | 実質ゼロ | hook が張れる点だけ | **ある。同期 hook はツール呼び出しをブロックする** | settings.json を書き換える |
| 端末画面 (multiplexer) | 無い | 人が見える範囲 | 無い | 端末構成を変える |

判断の軸は遅延ではなく**侵襲**にした方がよい。可視化のために本業を遅くするのは順序が逆で、
これは [サブエージェントと全体進捗を VS Code 拡張で可視化する](subagent-progress-ui-in-vscode.md)
でも同じ結論になっている。承認ゲートのように hook でしか取れないものだけ hook に残す。

## 3 つのツール

| | claude-devtools | OpenTelemetry | cmux |
|---|---|---|---|
| データ源 | セッション JSONL | 公式エクスポータ | 端末画面 |
| 見えるもの | トークンを 7 分類で帰属 (CLAUDE.md / skills / @ 参照ファイル / ツール入出力 / thinking / チーム / ユーザー入力)、コンテキスト圧縮の検出、ツール呼び出しの中身、サブエージェントの実行ツリー | 横断の時系列。セッション数・コスト・トークン・ツール判定・稼働時間 | 今まさに動いている画面。ペインごとに割り当てて並べる |
| 向く用途 | 1 セッションの事後解剖 | 複数セッション・複数人の傾向 | 並列実行中の介入 |
| 入れ方 | 単体アプリ。設定不要、Claude Code に触らない | 環境変数のみ | プラグイン (`hummer98/using-cmux`) |

claude-devtools は JSONL を読むだけなので Claude Code を一切変更しない。まずこれで現状を見る。
CLAUDE.md がトークンをどれだけ食っているかがそのまま出るので、規約を削る根拠になる。

cmux は観測というより**並列実行の器**。`cmux-team` は Master / Manager / Conductor / Agent の 4 層で
git worktree ごとにエージェントを立てる。ここまで来ると観測の話ではなくオーケストレーションの話。

## OpenTelemetry の実際

出典のブログより公式ドキュメントの方が広い。最小構成はこれだけ。

```sh
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

`claude_code.session.count` がバックエンドに出れば通っている。

メトリクスは 8 種類。`session.count` `lines_of_code.count` `pull_request.count` `commit.count`
`cost.usage` (USD) `token.usage` (tokens) `code_edit_tool.decision` `active_time.total` (秒)。
イベントは `user_prompt` `assistant_response` `api_request` `api_error` `api_refusal`
`tool_result` `tool_decision` `permission_mode_changed` `auth` `mcp_server_connection` など。

**ブログの「`tool_parameters` に Bash コマンドやファイルパスが含まれる」は現在は正しくない。**
既定では伏せられていて、出すには明示的に opt-in する。ここが一番の注意点なので分けて書く。

| 環境変数 | 既定 | 出るようになるもの |
|---|---|---|
| `OTEL_LOG_USER_PROMPTS=1` | 伏せる (`<REDACTED>`) | プロンプト本文 |
| `OTEL_LOG_ASSISTANT_RESPONSES=1` | `OTEL_LOG_USER_PROMPTS` に従う | 応答本文 |
| `OTEL_LOG_TOOL_DETAILS=1` | 伏せる | Bash コマンド、ファイルパス、MCP / skill / subagent 名、MCP の引数 |
| `OTEL_LOG_TOOL_CONTENT=1` | 伏せる | ツールの入出力本体 (beta トレースが要る) |
| `OTEL_LOG_RAW_API_BODIES=1` | 伏せる | 会話履歴とシステムプロンプト全部。上 3 つへの同意を含む |

つまり**既定のまま入れれば秘密は出ない**。コストと回数だけ見たいなら何も足さなくてよい。
逆に「何をしたか」を見たくて `OTEL_LOG_TOOL_DETAILS` を入れた瞬間、コレクタが機密の置き場になる。
そこを分かって入れる。共有のコレクタに送るなら既定のまま、手元の Jaeger なら opt-in、という分け方になるはず。

beta のトレースを有効にすると span が階層で出る。ブログが自作していた
Session / Turn / Tool_call の 3 階層は、今は公式側にある。

```
claude_code.interaction        # ユーザーのプロンプト 1 回
├── claude_code.llm_request
├── claude_code.hook           # PreToolUse / PermissionRequest
└── claude_code.tool
    ├── claude_code.tool.blocked_on_user
    └── claude_code.tool.execution
```

`CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` と `OTEL_TRACES_EXPORTER=otlp` で入る。
Bash の子プロセスに `TRACEPARENT` が伝播するので、ビルドやテストまで 1 本の trace で追える。
`blocked_on_user` が独立した span になっているのが効く。**待たせているのが人間なのかモデルなのかが分かれる**。

## 段階的に入れる

1. claude-devtools を入れて 1 セッション解剖する。設定を触らないので取り返しがつく
2. OpenTelemetry を既定のレダクションのまま入れる。コストとトークンの推移だけ取る
3. 足りない項目が分かってから beta トレースか opt-in フラグを足す
4. 並列実行が必要になったら cmux。ここは観測ではなく実行の話なので分けて判断する

## ここが弱い

- **何も試していない。** 3 つとも入れていない。OTel の設定値だけは公式ドキュメント由来なので確度が高いが、
  実際に `claude_code.session.count` が出るところまで確認していない
- **claude-devtools は第三者の単体アプリ。** `~/.claude` を読む。読み取り専用マウントと
  `--network none` で閉じられると記事にはあるが、確かめていない。何を外に出すかは自分で見る必要がある
- **どのメトリクスが実際に判断に効くかが分かっていない。** 記事は「コンテキスト圧縮 3 回以上でタスクが大きすぎる」
  「エラー率 12% は許容外」という具体的な閾値を出しているが、根拠は書かれていない。自分の値で取り直す
- **JSONL の形式は非公開。** claude-devtools も自作パーサも同じ前提に乗っている。バージョンで壊れうる
- **Windows。** claude-devtools はネイティブアプリを配っているが、cmux は端末 multiplexer なので
  Windows での扱いを確かめていない
- **観測を入れて何を変えるか決めていない。** 見えるようになっただけでは何も直らない。
  2 で取ったコストを見て CLAUDE.md を削る、くらいまで先に決めておかないとダッシュボードが飾りになる

## 昇格の目安

これが揃ったら type を `note` から変える (.claude/rules/knowledge-authoring.md「note を昇格させる」)。ファイルは動かさない。

- [ ] type を決めた → OTel の設定は `reference`、データ源 4 つの選び方は `concept` に分かれる見込み。
      1 ファイルにまとめない
- [x] sources に一次情報がある → 公式の monitoring-usage
- [ ] applies_to に検証したバージョンがある
- [ ] 実際に試して verified_at を書ける → 上の 1 と 2 を通す
