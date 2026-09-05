---
type: how-to
nature: best-practice
title: hook 入力は環境変数で切るプローブと負のコントロールで実測すべき
description: >-
  How to measure what a registered Claude Code hook actually receives without changing the production
  log format or faking business state: put the probe in a separate file enabled only by an environment
  variable the agent cannot set for itself, dump the fields under test to a dedicated JSONL, emit one
  unconditional output as a negative control so "not observed" can be distinguished from "not emitted",
  call the probe right after input parsing and before any early return, and remove it afterwards with a
  grep-zero check. Use when a spec has TBD rows like "does systemMessage reach the user" or "what does
  tool_response contain". Not for permanent telemetry.
tags: [claude-code, observability, evaluation]
keywords: [プローブ, 実測, 環境変数, 負のコントロール, hook 入力, tool_response, systemMessage, 固定キー, decisions.jsonl, 早期 return, 撤去, grep 0 件, stream-json, 業務条件, 寄生した assertion]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
intervention: hook
---

# 環境変数で切るプローブと負のコントロールで hook 入力を実測する

## 前提

- hook は判定記録を固定キー (例: 10 キー) の JSONL に書いていて、実測したいフィールド (`permission_mode` / `tool_response.status` / `agent_type` / `model` / `run_in_background` …) の置き場が無い
- 確かめたい出力 (`systemMessage` など) を出す経路が業務条件に縛られていて、通常の操作では 1 度も出ない
- 環境変数は Claude Code のセッション開始時に読まれる。Bash ツールで前置しても外側の hook プロセスには届かない

## 手順

1. **プローブを別ファイルに置く** (`lib/probe.sh`)。本体の hook に `if` で埋め込まない。既定で副作用ゼロ
2. **環境変数で有効化する** (`WORKFLOW_PROBE=1`)。AI が自分で立てられないので、勝手に記録を増やせない。有効化は人間がセッションを起動するときの操作で、新しいセッションが要る
3. プローブは 2 つのことをする
   - 対象フィールドの**値**と、その他のキーの有無・型を専用の JSONL (`logs/probe.jsonl`) に落とす。出力は既存の書き込みヘルパ (伏字化と 4 KB 切り詰め) を通す
   - 確かめたい出力を**業務条件によらず必ず 1 件**出す (例: `Agent` の呼び出しで無条件に `systemMessage` を 1 つ)
4. **呼び出しは入力の読み込み直後、早期 return より前**に置く。「依存スクリプト不在で無出力終了」の経路の後ろに置くと 1 行も残らない
5. 観測は 2 つの面で行う
   - 対話 UI: 人間がサブエージェントを 1 つ起動して警告が出るかを見る
   - ヘッドレス: `claude -p … --output-format stream-json --verbose` の出力に `{"type":"system","subtype":"informational",…}` が載るかを見る。2 つの面で結果が分かれることがある (対話には出ず、stream-json には level notice で載った)
6. **撤去する。** `grep -rn 'WORKFLOW_PROBE\|probe' .claude` が 0 件であることで撤去の完了を確かめる

## 確認方法

負のコントロールが要点。`probe.jsonl` に該当行がある (hook は起動していて出力もしている) のに対話 UI に警告が出なければ、「届かない」と結論できる。
負のコントロールが無いと、観測されなかったとき「届かない」のか「そもそも出していない」のかを区別できず、測れないものを「測って出なかった」と誤読する。

撤去の際に、既存のテストの前半がプローブの assertion に寄生していたことが分かった。撤去は本来の検査を書き直す機会にもなる。

## つまずきどころ

- 本番の記録にキーを足す案は、実測のために機械が読む契約を変え、戻し忘れが記録の形として残る。`note` 欄に JSON を詰める案は自由文の性質を失い、切り詰めで先に落ちる
- 業務条件を満たす状況を作って測る案 (エージェント定義を実装し、チケットの記載を書き換える) は、測定のために正史のアセットを増やし状態を偽装することになる
- 一時的な逸脱 (値を記録する、記録の表に無いパスを増やす) は、期限と検査手段 (grep 0 件) が最初から決まっていれば受け入れられる
- [実測の前に外れたときの縮退を書いておく](../workflow/write-fallback-condition-before-measuring.md)。プローブを仕込む前にやること
- [Agent ツール周りの hook 入出力の一覧](../agent/agent-tool-hook-fields-reference.md)。この方法で確定した事実の一覧
