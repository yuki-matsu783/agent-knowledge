---
type: pitfall
nature: finding
title: transcript を --argjson で jq に渡したら引数長の上限で無言で止まった
description: >-
  Explains why a hook that reads the Claude Code transcript dies without a message once the session grows:
  transcript lines embed the raw stdin/stdout of every tool_use and tool_result, so slicing new lines into a
  shell variable and handing them to `jq --argjson` blows past the process command-line limit (about 32KB on
  Windows), `jq` never starts, exit code 126 propagates through `set -euo pipefail`, and the whole hook aborts
  silently. Use when a transcript-reading hook or script works on synthetic fixtures but stops firing on real
  sessions. Shows the fix: pass the file path and let `jq -R -n ... "$path"` read it with `inputs`, returning
  only the small aggregate. Not for the `--slurpfile` failure mode, which is about broken side inputs rather
  than size.
tags: [claude-code, observability]
keywords: [--argjson, argv, Argument list too long, 引数長, コマンドライン長, 32KB, exit 126, jq, inputs, transcript, JSONL, set -euo pipefail, 無言, hook, tool_use, tool_result, ペイロード]
status: stable
sources:
  - https://jqlang.github.io/jq/manual/
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
stale_after: 2027-03-05
---

# transcript を --argjson で jq に渡したら引数長の上限で無言で止まった

## 症状

git push のたびに transcript を集計して投稿する hook が、ある時期から何も投稿しなくなった。
エラーは表示されず、hook が失敗したことすら分からない。合成フィクスチャによる単体テストはすべて通る。

手で同じ経路をなぞると `jq` の起動そのものが落ちていた。

```
Argument list too long
exit=126
```

## 原因

集計を 2 つの関数に分けていた。前段が新規行を JSON 配列としてシェル変数へ切り出し、後段へ
`--argjson entries "$new_entries"` で渡す形である。

transcript の行には `tool_use` と `tool_result` の生の入出力 (Read や Bash の出力、Edit の差分) がそのまま入る。
そのため**新規行がわずか 32 件 (約 120KB) でもこの引数が肥大化**し、プロセス生成時のコマンドライン長の上限を超える。
実測ではおよそ 32KB で、Windows で観測した。

上限を超えると `jq` は起動すらせず 126 で終わる。呼び出し元が `set -euo pipefail` なら、そこで hook 全体が即座に中断する。
中断は握りつぶされるので、利用者からは「投稿が止まった」としか見えない。

行数ではなくバイト数で決まるので、**行数を基準にしたテストでは踏めない**。フィクスチャは 1 行が数十バイトで、実データは 1 行が数 KB になる。

## 回避策

**transcript の中身をシェル変数にもコマンドライン引数にも載せない。ファイルパスを渡して `jq` に読ませる。**

```sh
# 悪い: 中身が argv に乗る
new_entries=$(sed -n "$((cursor+1)),\$p" "$transcript_path" | jq -s -c '.')
jq -n --argjson entries "$new_entries" '...'

# よい: パスだけが argv に乗る
jq -R -n --argjson skip "$cursor" '
  [inputs | select(length > 0)]           # 空行を除く
  | .[$skip:]                             # カーソル以降だけ
  | map(fromjson? // empty)               # 壊れた行は捨てる
  | { tools: (map(select(.type == "assistant")) | length) }
' "$transcript_path"
```

- 関数を分けたいときも、**分割点は「巨大な中間データを跨がない位置」に置く**。上の例は 1 回の `jq` に閉じている
- stdout へ返すのは集計済みの小さいオブジェクトだけにする。transcript がどれだけ大きくても影響を受けない
- `-R` と `inputs` で 1 行ずつ生文字列として読み、`fromjson?` で壊れた行を落とす。1 行の破損で全体を失わない
- 同じ理由で、行の中身を `xargs` や環境変数に載せる経路も避ける

この事故の後に見つかった別の壊れ方として、**状態ファイルが 0 バイトに壊れると恒久的に集計不能になる**ものがある。
中断が中途半端な書き込みを残し、次回それを `--argjson existing` に渡して必ず失敗する形だった。
状態を読む側に「空でなく有効な JSON か」を検査して既定値へ落とす自己回復を入れておく。

## 再現条件

別リポジトリの実 transcript を扱う hook で観測した。Windows での実測。Claude Code のバージョンは記録されていない。
上限値は OS とシェルで違うので、32KB という数字は Windows での目安として読む。

方式の正しさと、実装が実データのサイズと型のゆらぎに耐えるかは別の検証軸になる。
transcript 処理を変えたら、手元の本セッション自身の transcript に対して直接関数を呼んで確かめる。

## 関連

- [jq の --slurpfile は副入力が壊れていると呼び出し全体を失敗させる](jq-slurpfile-fails-whole-call-on-broken-side-input.md)。同じく jq への入力の渡し方で hook が全滅する
- [transcript の user 行の message.content は配列とは限らない](../../workflow/transcript-user-content-may-be-string.md)。同じ調査で連鎖的に見つかった型のゆらぎ
- [Claude Code の transcript JSONL は /compact を挟んでも追記専用である](../../workflow/transcript-jsonl-is-append-only-across-compact.md)。行カーソルが何を指すか
