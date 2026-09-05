---
type: pattern
nature: best-practice
title: ガード hook は enforce / dry-run / off の 3 モードで運用すべき
description: >-
  Gives a guard hook three modes selected by one environment variable, so a new rule can ship in
  dry-run where it advises instead of blocking, and every decision, including the ones that passed,
  is appended to a JSON Lines log that shows afterwards whether the hits were the intended ones.
  Use when adding a PreToolUse deny whose pattern might misfire, when a guard needs to be turned off
  for one session without editing settings, or when nobody can tell how often a guard actually
  fires. Not for injection hooks, which already fail open, and not a substitute for
  disableAllHooks when every hook should stop.
tags: [claude-code, security, observability]
keywords: [hook, dry-run, ドライラン, 無効化, 環境変数, GUARD_MODE, enforce, off, ログ, JSON Lines, logs, 誤爆, 空振り, 段階導入, PreToolUse, exit 2, systemMessage, disableAllHooks, settings.json, env]
status: stable
verified_at: 2026-09-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/settings
  - .claude/hooks/protect-generated.sh
intervention: hook
---

# ガード hook は enforce / dry-run / off の 3 モードで運用する

## 課題

ガード hook を新しく足すとき、判定が正しいかを確かめる手段が無い。パス一致も正規表現も、書いた本人が想定していない形に当たる
([生の文字列でコマンドを判定すると引用符とコメントに誤爆する](../20-PreToolUse/regex-command-match-misfires.md))。厳しすぎれば作業が止まり、緩ければ入れた意味が無い。

確かめられない理由は、hook が**止めた回しか表に出ない**ことにある。通した回は何も残らないので、次の 2 つがどちらも分からない。

- 止めた回が想定内の HIT だったのか、書き損じによる空振りだったのか
- 止めるべきだったのに素通りした回があったのか

さらに、いざ邪魔になったときに外す手段が settings.json の編集しかない。それは live reload で即座に効くうえ、
ガードの設定自体をエージェントから守る設計 ([ガードの設定と hook スクリプト自身をエージェントから守る](../20-PreToolUse/protect-guard-config-from-the-agent.md)) と正面から衝突する。
「一時的に止める」と「ガードを恒久的に外す」が同じ操作になっているのが問題。

## 解決

環境変数 1 つで 3 モードを切り替え、モードによらず全判定をログに 1 行ずつ追記する。

| モード | 判定 | 出口 | 用途 |
|---|---|---|---|
| `enforce` (既定) | する | HIT なら exit 2 | 通常運用 |
| `dryrun` | する | HIT でも exit 0。`systemMessage` で助言だけ返す | 新しいルールの慣らし |
| `off` | しない | 即 exit 0 | この 1 本だけ切りたいとき |

既定を enforce にする。変数が無い状態が一番強い側になるようにして、設定漏れがガードの消失にならないようにする。

```sh
#!/bin/sh
# PreToolUse (Write|Edit): 生成物の手編集を止める。
# GUARD_MODE=enforce (既定) | dryrun (止めずに記録と助言) | off (判定しない)
mode=${GUARD_MODE:-enforce}
log() {
  mkdir -p logs
  printf '{"ts":"%s","hook":"protect-generated","mode":"%s","result":"%s","target":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$mode" "$1" "$2" >> logs/hooks.jsonl
}
if [ "$mode" = off ]; then log off ""; exit 0; fi

f=$(jq -r '.tool_input.file_path // empty' | tr '\' '/')
hit=pass
case "$f" in
  *INDEX.md | *index.jsonl | */slides/*.html) hit=generated-file ;;
esac
log "$hit" "$f"
[ "$hit" = pass ] && exit 0

if [ "$mode" = dryrun ]; then
  printf '{"systemMessage":"[dry-run] enforce なら止めていた (%s): %s"}\n' "$hit" "$f"
  exit 0
fi
echo "生成物なので手で編集しない: $f" >&2
exit 2
```

要点は 4 つ。

1. **判定はモードの外に 1 つだけ置く。** モードが変えるのは判定結果の扱いだけにする。dryrun と enforce で判定コードが分かれると、dry-run で得た結果が本番の保証にならない
2. **通した回も書く。** `result: "pass"` の行があって初めて、HIT の比率と取りこぼしを後から数えられる。止めた回だけのログは「止めすぎ」しか見えない
3. **dry-run の助言は `systemMessage` で返す。** exit 0 のときの stderr は debug log 止まりで Claude にも人にも届かない。JSON で返せば transcript に出る。人の判断を挟みたいなら `permissionDecision` を `ask` にする段も置ける
4. **ログは JSON Lines で `logs/` に置き、gitignore する。** 絶対パスやコマンド全文が入るのでコミットしない。1 行 1 判定なら `jq` で集計できる ([生のコマンド実行を deny してラッパスクリプトへ誘導する](../20-PreToolUse/command-wrappers-instead-of-raw-bash.md) のログ置き場と揃える)

新しいガードは dryrun で入れる。数日運用してログの `result` を数え、HIT が想定どおりで pass に取りこぼしが無いことを確かめてから enforce に上げる。

## 適用条件

効くのは、パスやコマンド文字列の一致で判定するガードで、誤爆の可能性があるもの。判定が純粋な関数で、dry-run しても副作用が出ないことが前提になる。

**off を渡す経路を限定できることも前提。** hook は Claude Code のプロセスの環境を継承する。Bash ツールの中で `export` しても、それは別のプロセスなので hook には届かない。
経路は実質 2 つで、性質がまったく違う。

- **claude を起動したシェルの環境**。人が `GUARD_MODE=off claude` と打つときだけ入る。セッション中のエージェントからは触れない。off はここからだけ渡す
- **settings.json の `env` ブロック**。ここに書くとエージェントが編集でき、live reload で効いてしまう。off の値をここに書かない

全部の hook を止めてよいなら、自前の off より公式の `disableAllHooks` を使う。自前 off を作る理由は、公式には**個別の hook だけを止める手段が無い**ことにある。

注入系の hook にはモードは要らない。落ちても素通りが既定なので、dry-run と off は最初から実質そうなっている
([hook を注入系とガード系に分け、失敗時の既定を逆にする](injecting-vs-guarding-hooks.md))。

## トレードオフ

- **得る**: ガードを本番に入れる前に当たり方を確かめられる。誤爆したとき、なぜ一致したかがログに残る。切り戻しが設定の書き換えではなく起動時の変数になる
- **失う**: hook 1 本あたりのコードが倍近くになる。判定そのものより、モード分岐とログの方が行数を食う
- **off はガードを外す正規の経路を作ることになる**。守りたい線が敵対的な回避にも耐える必要があるなら、off を実装せず、管理者権限側 (managed settings、OS のファイル権限) に寄せる
- ログは放っておくと増える。日数か行数で切る処理を入れる。判定のたびに追記するので、ガードが毎ツール呼び出しで走るなら行数は速く伸びる
- モードの値は hook ごとに分けるか揃えるかを決める必要がある。揃えると 1 つの変数で全ガードが off になり、off の危険度が上がる

## 関連

- [hook を注入系とガード系に分け、失敗時の既定を逆にする](injecting-vs-guarding-hooks.md) — このパターンを当てる対象はガード系だけ
- [権限は permissions.deny ではなく PreToolUse hook で止める](../20-PreToolUse/deny-by-hook-not-permissions.md) — dry-run できるのは判定が hook 側にあるから。deny ルールにはこの段が作れない
- [ガードの設定と hook スクリプト自身をエージェントから守る](../20-PreToolUse/protect-guard-config-from-the-agent.md) — off の経路を settings.json に置いてはいけない理由
- [生の文字列でコマンドを判定すると引用符とコメントに誤爆する](../20-PreToolUse/regex-command-match-misfires.md) — dry-run で見つけたい誤爆の典型
- [タイムアウトした hook はガードにならず素通りする](hook-timeout-fails-open.md) — ログに所要時間も書いておくと、timeout に近づいている hook を見つけられる
