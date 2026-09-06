---
type: pattern
nature: best-practice
title: 秘密は Read の deny ではなくエージェントが動かす環境に本物を置かないことで守るべき
description: >-
  Argues that denying Read on .env files protects only one of the paths by which a secret reaches the
  agent's context, because the agent still runs allowed commands whose stdout and stderr carry the real
  values (a failing test printing a request header, a debug dump, an error from a client library), and
  anything that lands in a tool result is already in the transcript and in every later API request.
  Proposes moving the boundary from "do not read it" to "the real value is not there": dummy credentials
  in the environment the agent runs, wrapper scripts that redact known token shapes, and the Read deny
  kept as accident prevention rather than as the last line. Use when hardening a repository the agent
  runs tests or debugging commands in, or when writing permissions.deny rules for secret files. Not for
  blocking exfiltration of data the agent legitimately holds, and not an adversarial boundary against
  someone who can edit the settings, where the sandbox and OS ownership are what count.
tags: [claude-code, security, workflow]
keywords:
  - .env
  - permissions.deny
  - シークレット
  - 秘密
  - API キー
  - 漏洩
  - コマンド出力
  - stderr
  - tool_result
  - transcript
  - .env.test
  - ダミー値
  - マスク
  - リダクション
  - redact
  - 最小権限
  - gitleaks
  - pre-commit
  - Bash(cat .env)
status: stable
stale_after: 2027-03-06
sources:
  - https://code.claude.com/docs/en/security-guidance
  - https://code.claude.com/docs/en/permissions
  - https://code.claude.com/docs/en/sandboxing
  - https://timewell.jp/columns/claude-code-env-security-guide
  - https://zenn.dev/ga14tools/articles/claude-code-env-security
  - https://note.com/hinaao3600/n/n70107c94f635
intervention: tool
---

# 秘密は Read の deny ではなくエージェントが動かす環境に本物を置かないことで守るべき

## 課題

`.env` を守る話は `permissions.deny` に `Read(**/.env*)` を並べるところで終わりがちで、3 本の記事もそこを主題にしている。
入口を 1 つ塞いだのは確かだが、秘密が context に届く経路は読み取りだけではない。

| 経路 | deny が効くか |
|---|---|
| Read ツールや `cat` でファイルを開く | 効く |
| **許可済みコマンドの stdout / stderr に値が乗る** | **効かない** |
| Grep がソース中の直書きを拾う | 部分的 |

真ん中が塞げない。`npm test` を許可した時点で、その出力に何が乗るかはエージェントの制御下にない。
クライアントライブラリが接続エラーで Authorization ヘッダごと出す、デバッグ用のダンプが環境変数を全部並べる、
スタックトレースに接続文字列が入る。どれも「秘密を読もうとした」わけではないのに、値は tool_result として context に入る。

一度入ると戻せない。tool_result は [transcript の JSONL に追記され](transcript-jsonl-is-append-only-across-compact.md)、
[Messages API は毎ターン会話全文を送り直す](messages-api-is-stateless-and-resends-the-whole-conversation.md)ので、以降の全リクエストに乗り続ける。
[compact は要約に組み直す](compact-rebuilds-the-sent-conversation-as-a-summary.md)が、要約に残らない保証も無い。

3 つ目の Grep が「部分的」なのは、[Grep ツールが .gitignore に載ったファイルを飛ばす](grep-tool-skips-gitignored-files.md)から。
`.env` を gitignore していればこの経路は細い。逆に、コメントや TODO に直書きされた鍵は gitignore の外なので普通に載る。

## 解決

境界を「読ませない」から「本物がそこに無い」へ移す。deny を捨てる話ではなく、deny を最後の砦にしない話。

```mermaid
flowchart LR
  E[.env 本物] -->|人が必要なときだけ| P[本番作業]
  D[.env.test ダミー] --> T[エージェントが叩くテスト・デバッグ]
  T -->|出力| W[ラッパでマスク]
  W --> C[context]
  E -.->|deny + gitignore| C
```

### 1. エージェントが動かす環境にはダミーだけを置く

コミットしてよい値だけを `.env.test` に入れ、テストがそれを読む設定にする。
漏れても困らない値なら、出力に乗ること自体が問題でなくなる。

```bash
STRIPE_SECRET_KEY=sk_test_not_a_real_key_dummy_value
DATABASE_URL=postgres://test:test@localhost:5432/testdb
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
```

本物は 1Password CLI や Secrets Manager に置き、必要なときに人が注入する。
エージェントのセッションに常時ぶら下げない。

### 2. 本物が要るコマンドはラッパ越しにして出力を落とす

生のコマンドを deny して[ラッパスクリプトへ誘導する](../hooks/20-PreToolUse/command-wrappers-instead-of-raw-bash.md)。
ラッパ側で既知のトークン形状を潰してから返す。

```sh
"$@" 2>&1 | sed -E \
  -e 's/sk-ant-[A-Za-z0-9_-]+/sk-ant-***REDACTED***/g' \
  -e 's/AKIA[0-9A-Z]{16}/AKIA***REDACTED***/g'
```

### 3. Read の deny は残すが、事故の抑止として扱う

`Read(**/.env*)` は「うっかり開く」を止める価値があるので消さない。ただし 2 点。

- パターンは `**/` を前置する。`Read(.env*)` はルート直下にしか効かず、`apps/web/.env` に一致しない (手元では未確認)
- [Edit/Write の deny がサブプロセス経由で抜けるのと同じ理由](../hooks/20-PreToolUse/protected-file-rewritten-via-subprocess.md)で、
  スクリプトが内部で開くファイルには届かない

## 適用条件

- 効く: テストとローカル開発。ダミーで通る処理。エージェントに任せる作業の大半はここに入る
- 効かない: 本物の資格情報が無いと成立しない作業 (本番 API の疎通確認、実データの移行)。
  ここはエージェントに渡さず[人がやる側に置く](reversibility-decides-who-acts.md)
- 効かない: マスクは既知のパターンにしか当たらない。社内発行のトークン形式は自分で足すことになり、
  base64 や JSON に埋まった値は外れる。マスクは保証ではなく確率を下げる手段
- 上位の手段が先。`.env` をリポジトリの外かコンテナのマウント外に置けるなら、そもそもこの表の 3 経路が全部消える

## トレードオフ

- 得る: 秘密が context に入る確率が下がる。入ってからは取り消せないので、確率を下げることにしか価値が無い
- 失う: ダミー値で通るようにモックを揃える手間。本物でしか出ない疎通の不具合はエージェントから見えなくなる
- 却下した案: CLAUDE.md に「出力に鍵を出すな」と書く。出力はモデルが書くものではないので指示が届く先が無い
  ([CLAUDE.md の禁止事項は hook で防ぐべき](../rules/prohibitions-in-shared-claude-md-belong-in-hooks.md))
- 確かめていないこと: 出発点は 3 本の記事で、手元では `.env.test` 運用も出力マスクも常用していない。
  マスクの取りこぼし率も、`Read(.env*)` がサブディレクトリに効かないことも測っていない

## 関連

- [外部にデータを送れるコマンドは要求の出どころに関わらず PreToolUse hook で止めるべき](../hooks/20-PreToolUse/deny-data-egress-regardless-of-origin.md)。こちらは context に入った後を守る層。本パターンは入る前を薄くする層で、両方要る
- [権限は permissions.deny ではなく PreToolUse hook で止めるべき](../hooks/20-PreToolUse/deny-by-hook-not-permissions.md)。deny リストが文字列一致で破れる理由
- [Grep ツールは .gitignore に載ったファイルを検索しない](grep-tool-skips-gitignored-files.md)。3 経路目が細い理由
