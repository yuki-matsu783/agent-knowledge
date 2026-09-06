---
type: reference
nature: fact
title: Claude Code の transcript は会話・状態・添付の行が混ざった JSONL である
description: >-
  Inventory of the line types Claude Code writes to a session transcript under ~/.claude/projects and what
  produces each one: conversation lines (assistant / user / system), sidecar state lines re-appended whenever
  a value changes (mode, last-prompt, ai-title, queue-operation, pr-link, worktree-state, file-history-*), and
  `attachment` lines whose subtypes record hook results, skill and tool listings, plan/auto mode transitions,
  file injections and context reminders. Use when building a usage report, an audit, a session viewer, or any
  parser over `transcript_path`, and when deciding which line type answers "what did this session actually
  do". Not a specification: the format is undocumented and version-specific, and subagent transcripts live in
  a separate file described elsewhere.
tags: [claude-code, observability, context-management]
keywords: [transcript, JSONL, transcript_path, ~/.claude/projects, attachment, tool_use, toolUseResult, thinking, attributionSkill, gitBranch, cost-state, totalCostUSD, stop_hook_summary, compact_boundary, file-history-delta, persisted-output, tool-results, worktree-state, セッションログ, 行の種類]
status: stable
verified_at: 2026-09-06
stale_after: 2027-03-06
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
  - knowledge/workflow/transcript-jsonl-is-append-only-across-compact.md
---

# Claude Code の transcript は会話・状態・添付の行が混ざった JSONL である

## 対象

Claude Code が `~/.claude/projects/<project>/<sessionId>.jsonl` に書く行の一覧。
`version` 2.1.232〜2.1.261 の VS Code 拡張 (`entrypoint: claude-vscode`) で確かめた。CLI では確かめていない。

親セッションのファイルだけを対象にする。サブエージェントの行はここには出ず
`<sessionId>/subagents/agent-*.jsonl` に分かれるので
([詳細](subagent-transcript-is-separate-file-with-every-tool-call.md))、親のファイルに `isSidechain: true` の行は現れない。

**行の種類は「どう使ったか」で決まる。** hook を登録していなければ `hook_*` は 1 件も出ないし、Artifact も
worktree も PR も使わなければその行は無い。以下の一覧は「その操作をしたときに何が書かれるか」であって、
どのセッションにも全部あるという意味ではない。

## 概要

1 行 1 JSON の JSONL で、上から時系列に並ぶ。人が「1 回頼んで 1 回返ってきた」と感じるやりとりでも、
**ツールを 1 回使うごとに 2 行以上増える**。

次は「ファイルを 1 つ読ませた」ときに書かれる行を、フィールドを大きく省いて並べたもの (`…` は省略)。

```jsonl
{"type":"user","uuid":"b89e…","parentUuid":null,"message":{"role":"user","content":"README を読んで"}}
{"type":"attachment","attachment":{"type":"total_tokens_reminder", …}}
{"type":"assistant","uuid":"c723…","parentUuid":"b89e…","timestamp":"2026-09-06T08:00:59.424Z",
 "gitBranch":"main","cwd":"c:\\…\\agent-knowledge","version":"2.1.261",
 "message":{"model":"claude-opus-5","content":[{"type":"text","text":"読みます"}],
            "usage":{"input_tokens":2,"output_tokens":286,"cache_read_input_tokens":29767, …}}}
{"type":"assistant","uuid":"4a2d…","parentUuid":"c723…",
 "message":{"content":[{"type":"tool_use","id":"toolu_01WY…","name":"Read","input":{"file_path":"README.md"}}], …}}
{"type":"user","uuid":"9918…","parentUuid":"4a2d…",
 "message":{"content":[{"type":"tool_result","tool_use_id":"toolu_01WY…","content":"# agent-knowledge\n…"}]},
 "toolUseResult":{"file":{"filePath":"README.md","numLines":42}, …}}
{"type":"assistant","uuid":"f01c…","parentUuid":"9918…",
 "message":{"content":[{"type":"text","text":"README は …"}], "usage":{ … }}}
{"type":"last-prompt","lastPrompt":"README を読んで","leafUuid":"f01c…","sessionId":"…"}
```

ここから読み取れることが 4 つある。

- **`type: user` はツール結果でもある。** 4 行目の `tool_use` に対する答えが 5 行目で、これも `user` 行になる。
  人間が打ったのは 1 行目だけ
- **`parentUuid` が 1 本の鎖になっている。** `null` から始まり、`uuid` を親として辿ると会話の順序が復元できる
- **`gitBranch` `cwd` `version` が毎行に載る。** どのブランチのどのディレクトリで、どの版が動いたかが行ごとに分かる
- **会話ではない行が混ざる。** 2 行目の `attachment` と最後の `last-prompt` は、モデルへの差し込みとセッションの現在値で、
  会話の鎖には入らない

実物の `usage` にはこの例よりずっと多くのキーがある (`cache_creation_input_tokens`、
`output_tokens_details.thinking_tokens`、`service_tier` など)。`tool_result` の中身も、Read なら
ファイル本文、Bash なら標準出力がそのまま入るので、1 行が数百 KB になることがある。

## 一覧

行は `type` で分かれる。

### 会話の行

| type | 何で書かれるか | 主なフィールド |
|---|---|---|
| `assistant` | モデルの応答 1 回。ツールを呼ぶたびに 1 行増える | `message.usage`、`message.model`、`message.content[]`、`requestId`、`effort`、`gitBranch`、`uuid` / `parentUuid` |
| `user` | 人間の入力**とツール結果の両方** | `message.content` (配列または文字列)、`toolUseResult` |
| `system` / `compact_boundary` | `/compact` と自動圧縮 | `compactMetadata.trigger` / `preTokens` / `postTokens` |
| `system` / `stop_hook_summary` | Stop hook が走った後 | `hookCount`、`hookInfos`、`hookErrors`、`preventedContinuation`、`hookAdditionalContext` |
| `system` / `api_error` | API エラーとリトライ | `error`、`retryAttempt`、`maxRetries`、`retryInMs` |
| `system` / `local_command` | 一部のスラッシュコマンドの出力 | `content` に `<local-command-stdout>` |

`assistant` の `message.content[]` に入るブロックは `tool_use` / `thinking` / `text` の 3 種で、
**thinking はそのまま保存される**。`gitBranch` は全 `assistant` 行に付く。
1 回の API 応答がブロックごとに複数行へ分かれ、どの行にも同じ `message.usage` が複製される
([詳細](transcript-usage-is-per-request-and-duplicated.md))。
skill の中での応答には `attributionSkill` に skill 名が入り、プラグイン由来なら `attributionPlugin` も付く。

### 状態の行

会話の木構造に属さず、`uuid` も `timestamp` も持たないものが多い。**値が変わるたびに同じ形の行が追記される**ので、
履歴ではなく「その時点の現在値」の列として読む。

| type | 何で書かれるか | 中身 |
|---|---|---|
| `attachment` | 次節を参照 | `attachment.type` で細分される |
| `last-prompt` | 直近のユーザ入力。resume の起点 | `lastPrompt`、`leafUuid` |
| `mode` | 権限モードの変更 | `mode` (`normal` 等) |
| `queue-operation` | 応答中に次の入力を打ち込むと | `operation` (`enqueue` 等)、`content` |
| `ai-title` | 会話タイトルの自動生成 | `aiTitle` |
| `bridge-session` | claude.ai 側との紐付け | `bridgeSessionId`、`ownerAccountUuid` |
| `atis-latch` | 内部の掛け金 (用途不明。値は空文字がほとんど) | `atis` |
| `pr-link` | PR を作る・触ると | `prNumber`、`prUrl`、`prRepository` |
| `file-history-delta` | ファイルを書き換えるたび | `trackingPath`、`messageId`、`backup` (退避先のメタ。本文は別ファイル) |
| `file-history-snapshot` | 上記の基準点 | `snapshot.trackedFileBackups` |
| `worktree-state` | `EnterWorktree` / `ExitWorktree` | `worktreePath`、`worktreeBranch`、`originalCwd`、`originalHeadCommit` |
| `relocated` | cwd が移ると | `relocatedCwd` |
| `frame-link` | Artifact を公開すると | `frameUrl`、`title`、`path` |
| `artifact-comment-monitor` | Artifact のコメント監視 | `artifacts[].state` |
| `artifact-autoreact-ledger` | 同上の自動返信の台帳 | `artifacts[].threads` |
| `cost-state` | セッションの最終行。後述のとおり滅多に出ない | `totalCostUSD`、`modelUsage`、`totalDuration` |

### `attachment` の subtype

`attachment` はモデルに渡す前に差し込まれた情報で、**「何が起きたか」を一番細かく残しているのはここ**。

| 系統 | `attachment.type` | 何で書かれるか |
|---|---|---|
| hook | `hook_success` / `hook_additional_context` / `hook_system_message` | hook が正常終了した / `additionalContext` を返した / `systemMessage` を返した |
| hook | `hook_blocking_error` / `hook_non_blocking_error` / `hook_cancelled` | hook がブロックした / 失敗したが続行した / 打ち切られた |
| 提示 | `skill_listing` / `invoked_skills` | skill 一覧を渡した / skill を起動した |
| 提示 | `agent_listing_delta` / `deferred_tools_delta` | サブエージェント一覧の変化 / 遅延ツール一覧の変化 (`ToolSearch` の対象) |
| 提示 | `command_permissions` | 権限設定を提示した |
| モード | `plan_mode` / `plan_mode_exit` / `plan_mode_reentry` / `plan_file_reference` | Plan モードの出入りと計画ファイルの参照 |
| モード | `auto_mode` / `auto_mode_exit` | auto モードの出入り |
| 差し込み | `file` / `edited_text_file` | `@` 参照などのファイル添付 / ファイル編集の反映 |
| 差し込み | `queued_command` | 積んだ入力の投入 |
| 差し込み | `nested_memory` | 下位ディレクトリの CLAUDE.md を読んだ |
| 差し込み | `read_truncation_notice` | 読み込みを切り詰めた |
| 注意喚起 | `total_tokens_reminder` | コンテキスト使用量。ほぼ毎ターン入るので最も多い |
| 注意喚起 | `batching_reminder_sent` / `silent_turn_reminder` / `todo_reminder` | 並列ツール呼び出しの促し / 無言のターン / TODO の再提示 |
| 注意喚起 | `compact_file_reference` / `date_change` | 圧縮後の参照復元 / 日付が変わった |
| その他 | `remote_session_change` | リモートセッションの変化 |

## 補足

### 「何をしたか」を知りたいときにどこを見るか

| 知りたいこと | 見る場所 |
|---|---|
| 使ったツールと引数 | `assistant` の `message.content[]` の `tool_use` (`name` / `input`) |
| ツールが返したもの | `user` の `toolUseResult`。Bash なら `stdout` / `stderr` / `interrupted`、Edit なら `oldString` / `newString` / `structuredPatch` / `originalFile`、Agent なら `agentId` / `status` / `resolvedModel` |
| どの skill の中での動きか | `assistant` の `attributionSkill` |
| hook が何をしたか | `attachment` の `hook_*` と `system` / `stop_hook_summary` |
| 人間に何を聞いたか | `AskUserQuestion` の `toolUseResult` の `questions` / `answers` |
| 権限モードの変遷 | `mode` 行 |
| どのブランチでの作業か | `assistant` の `gitBranch` |

### 行数は会話量ではない

- **`user` 行はほとんどがツール結果。** ツールを使う作業では 9 割を超える。人間が打った文を数えたいなら
  `toolUseResult` を持たず `isMeta` でもない行に絞る
- **状態の行と `attachment` が行数の多くを占める。** `attachment` だけで全体の 4 分の 1 に達することがあり、
  状態の行を合わせると 4 割近くになる。数えたいものがあるなら必ず `type` で絞ってから数える
- **`assistant` 行はターンではない。** 1 ターンがツール呼び出しで何往復もするため
  ([ターンは end_turn まで回るループ](turn-is-a-tool-use-loop-until-end-turn.md))、行数はツールの使い方に比例する

### 1 行は小さいとは限らない

`Edit` の結果には `originalFile` として**編集前のファイル全文**が入る。数百 KB の行は普通に現れる。

一方、大きすぎるツール出力は本文が別ファイルへ逃げる。`<persisted-output>` に置き換わり、
`Output too large (39.9KB). Full output saved to: ...\tool-results\<id>.txt` と先頭 2KB のプレビューだけが残る。
逃がしが起きるのは 30KB 前後から。逃がし先は `<sessionId>/tool-results/<id>.txt` で、こちらは 10MB を超えることもある。

つまり**行のサイズに上限は無く、逃がしがあるからといって小さいわけでもない**。読む側は 1 行を丸ごとメモリに載せる前提を疑う。
中身をシェル変数やコマンドライン引数に載せると別の形で壊れる
([argv 長の上限](../hooks/scripts/pass-transcript-by-path-not-argv-to-jq.md))。

### USD は当てにしない

`cost-state` は `totalCostUSD` とモデル別の `modelUsage` を持つ唯一の行で、セッションの最終行に置かれる。
ただし**滅多に書かれない**。2.1.25x 以降の 96 セッションを調べて 1 件しか無く、条件は特定できなかった。
コスト集計の入手経路として当てにせず、必要なら OpenTelemetry を使う。
`assistant` 行の `message.usage` を足し上げる方には別の限界がある
([過小カウント](transcript-usage-tokens-undercount.md))。

### 読む側の作り

- **未知の `type` と未知のキーは黙って捨てる。** `artifact-*` や `cost-state` のように、新しい機能がそのまま新しい行になる。
  形式は非公開で保証が無い
- **状態の行を変更履歴として読まない。** 同じ値が何度も追記されるので、重複を前提にする
- **秘密が入っている前提で扱う。** transcript はツールの生の入出力、編集前のファイル全文、ユーザの入力をそのまま持つ。
  リポジトリ内へミラーするなら gitignore の対象に入れる

## 関連

- [Claude Code の transcript JSONL は /compact を挟んでも追記専用である](transcript-jsonl-is-append-only-across-compact.md)。この一覧の前提になるファイルの性質
- [サブエージェントの transcript は親とは別の subagents/agent-<id>.jsonl にツール呼び出しごと残る](subagent-transcript-is-separate-file-with-every-tool-call.md)。この一覧に含めていない側
- [transcript の usage は API 応答 1 回分の値が全行に複製されたものである](transcript-usage-is-per-request-and-duplicated.md)。`assistant` 行の `message.usage` の詳細
- [追記ログの差分集計は行カーソルか id 畳み込みかを再送の有無で選ぶ](append-log-diff-by-cursor-or-fold.md)。増分を数えるときの方式
- [transcript の user 行の message.content は配列とは限らない](transcript-user-content-may-be-string.md)
- [Claude Code の実行を観測する層は後付けで入れられる](observability-layer-for-claude-code.md)。JSONL 以外の観測源との比較
