---
type: pattern
nature: heuristic
title: API エラーで止まった回は Stop hook が走らないので StopFailure で記録した方がよさそう
description: >-
  A Claude Code hook design for unattended runs: when a turn ends because of an API error (rate limit,
  overloaded, authentication, billing, max_output_tokens), Claude Code fires StopFailure instead of Stop,
  so the Stop-hook completion checklist never runs and the session goes quiet without a trace. Register a
  StopFailure command hook that appends the error type, details, and transcript path to logs/, optionally
  notifies externally, and let the SessionStart hook on resume report the last failure. Use when an
  overnight or auto-mode session stops with no explanation, or when the Stop hook is the only place the
  end of a turn is recorded. Not for recovering Claude's last real output, which StopFailure does not carry,
  and not for retrying the request, which the hook cannot do.
tags: [claude-code, observability, workflow]
keywords: [StopFailure, Stop, API Error, rate_limit, overloaded, authentication_failed, billing_error, max_output_tokens, last_assistant_message, transcript_path, logs, 放置, 静かに止まる, 記録, 通知, resume]
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
intervention: hook
---

# API エラーで止まった回は Stop hook が走らないので StopFailure で記録する

## 課題

放置していた Claude Code が朝には止まっていて、最後の行が `API Error: Rate limit reached` だけ、ということがある。
Stop hook にチケットの完了確認や通知を仕込んでいても、この止まり方では走らない。公式 hooks 文書は
「turn が API エラーで終わったときは Stop の**代わりに** StopFailure が走る」としている。Stop 側にしか記録が無いと、
止まった事実も理由も、そのときモデルが何をしていたかも残らない。

StopFailure の入力は `error` (種別)、`error_details`、`last_assistant_message`。ただし `last_assistant_message` は Stop のときと違って
**API エラーの文字列そのもの**で、モデルの最後の発話ではない。hook の出力と終了コードは無視される (terminalSequence を除く)。つまりこの hook では
何も返せず、副作用しか起こせない。

## 解決

StopFailure に「記録して、必要なら知らせる」だけの注入系 hook を 1 本置く。判断はしない。

```json
{ "hooks": { "StopFailure": [ { "hooks": [ { "type": "command", "command": "sh \"${CLAUDE_PROJECT_DIR}/.claude/hooks/stop-failure.sh\"", "timeout": 10 } ] } ] } }
```

```sh
#!/bin/sh
# StopFailure。記録だけ。注入系なので何があっても exit 0
mkdir -p logs
jq -c '{ts: (now|todate), event: "StopFailure", session_id, error, error_details, transcript_path, cwd}' >> logs/stop-failure.jsonl 2>/dev/null || true
exit 0
```

### 種別で扱いを分ける

`error` は matcher に使える。一過性のものと人が要るものを分ける。

| `error` | 意味 | やること |
|---|---|---|
| `rate_limit` `overloaded` `server_error` | 一過性。時間が経てば `resume` で続く | 記録。放置運用なら「N 分後に再開」を外に知らせる |
| `authentication_failed` `oauth_org_not_allowed` `account_on_hold` `billing_error` | 人が直すまで続かない | 記録 + 外部通知 (async) |
| `max_output_tokens` `invalid_request` | プロンプトか出力の問題。再開しても同じ所で止まりうる | 記録。transcript の末尾を人が読む |
| `model_not_found` `unknown` | 設定か未知 | 記録 |

外部通知は注入系の作法で書く (async、失敗しても exit 0)。hook から provider CLI や API を呼ばない規約はここでも守り、webhook 1 本に留める
([hook の判定材料はリモートに問い合わせず全実行環境で読めるものだけであるべき](../common/hooks-read-local-state-only.md) の境界はガード側の話だが、通知の依存も最小にする)。

### 何をしていたかは transcript から取る

`last_assistant_message` はエラー文字列なので、モデルが直前に何をしていたかは `transcript_path` の JSONL を末尾から読む。
記録には transcript_path を残しておき、読むのは人か次のセッションに任せる。hook の中で transcript を解析しない (1.5 秒級の予算に収まらない)。

### 次のセッションに知らせる

SessionStart (`resume` / `startup`) の注入 hook が `logs/stop-failure.jsonl` の末尾 1 行を見て、直近 1 件が今日なら
「前回のセッションは rate_limit で止まった (HH:MM)」を 1 行足す。これで再開したモデルが「なぜ途中で終わっているか」を知った状態で始められる
([状態を持たない LLM への環境情報は変わる頻度で hook イベントを分けて注入した方がよさそう](../common/split-state-injection-by-staleness.md))。

## 適用条件

- 効く: auto モードや夜間の放置、Stop hook に完了確認や通知を置いている構成
- 対話しながら使う分には要らない。画面にエラーが出るので人が見ている
- Gemini CLI に対応するイベントがあるかは確かめていない。Claude Code 2.1 の文書に基づく設計で、実際に rate_limit を起こして hook が走る所までは試していない

## トレードオフ

- 得る: 静かに止まった理由が残る。人が要る止まり方 (認証、課金) にすぐ気づける
- 失う: hook が 1 本増える。記録するだけなので、続きを自動で再開することはできない (resume は人か外側のスクリプトが叩く)
- Stop と StopFailure の両方に同じ「終わりの記録」を書くと重複する。終わりの記録は StopFailure、完了確認は Stop、と役目を分ける

## 関連

- [完了時にやらせたい作業はチケットに置き Stop hook で 1 回だけ機械的に差し戻すべき](../11-Stop/return-once-with-the-ticket-checklist.md)。走らなくなる側の Stop hook
- [hook は注入系とガード系に分かれ失敗時の既定は逆であるべき](../common/injecting-vs-guarding-hooks.md)。この hook は注入系
- [通知しなかった判定も skip として記録し記録の欠如を縮退と読めるようにすべき](../22-PostToolUse/record-skips-so-absence-means-degraded.md)。記録の無い終わり方を無くす動機
- [Claude Code の transcript JSONL は /compact を挟んでも追記専用である](../../workflow/transcript-jsonl-is-append-only-across-compact.md)。末尾を読めば直前の作業が分かる根拠
