---
type: pattern
nature: best-practice
title: 並行する hook の記録は追記の行長制限と一時ファイルと mkdir ロックで守るべき
description: >-
  A three-tier rule for files that Claude Code hooks write while running in parallel (all hooks on an
  event start together, and PostToolUse also fires concurrently for parallel tool calls): append-only
  logs are written with `>>` in single lines under 4 KB (PIPE_BUF) so the OS keeps them atomic;
  files that are read and rewritten go through a temp file plus `mv`; only read-modify-write counters
  take a `mkdir` lock (flock may be missing in Git Bash) that gives up after 2 seconds and is force-released
  when older than 60 seconds, because a hook killed by timeout never runs its `trap`. Use when several
  hooks write the same JSONL, JSON state, or usage counters. Not for the application's own data files,
  and not a general filesystem-locking guide.
tags: [claude-code, observability, workflow]
keywords: [並行書き込み, PIPE_BUF, 4 KB, JSONL, 追記, 一時ファイル, mv, 原子的, mkdir ロック, flock, Git Bash, 陳腐化, stale lock, trap が効かない, timeout, 2 秒, 60 秒, read-modify-write, 加算が消える]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://pubs.opengroup.org/onlinepubs/9699919799/functions/write.html
intervention: hook
---

# 並行する hook の記録は追記の行長制限と一時ファイルと mkdir ロックで守る

## 課題

hook が `logs/` に判定記録・セッション状態・使用量の集計を書く構成で、同時書き込みの規定が無かった。
[同じイベントの hook は並列に走り](hooks-run-in-parallel-not-in-array-order.md)、PostToolUse は並列ツール呼び出しでも同時に発火するので、競合は 3 種類ある。

| ファイル | 書く側 | 競合の形 |
|---|---|---|
| 判定記録 (`decisions.jsonl`) | 全 hook (11 本) | 追記の行が割れる |
| 承認の記憶 (`approvals.json`) | 書く hook 1 本、読む hook 1 本 | 書きかけを読む |
| 使用量の集計 (`usage/<branch>.json`) | 並行するサブエージェントの Stop | read-modify-write で片方の加算が消え、オフセットが巻き戻って二重計上 |

## 解決

必要な強度が違うので 3 段に分ける。強い手段を全部に掛けない。

1. **追記だけのファイル (`*.jsonl` / `*.log`)**: 1 行を `>>` で追記し、**1 行を 4 KB (`PIPE_BUF`) 未満に保つ**。POSIX が `O_APPEND` の追記に原子性を保証する上限がこれ。
   自由文の項目 (`note` / `target`) は合わせて 1 KB で切り詰め、切ったことを末尾に `…` で示す。切り詰めは書き込みヘルパの中で行う (呼び手に任せると 11 通りに分かれる)
2. **読んで書き換えるファイル**: 同じディレクトリの一時ファイル (`<name>.tmp.<pid>`) へ書いてから `mv` で置き換える。同一ファイルシステム内の rename は原子的
3. **read-modify-write が競合する加算**: `mkdir <name>.lock` で直列化する。`flock` は Git Bash に無いことがあり、`mkdir` は存在すれば失敗するので原子的。
   取れなければ**最大 2 秒待って諦め、加算せず終了 0** (案内側なので本体を止めない)。諦めたことは追記専用の実行ログに 1 行残す

3 段目には 2 つの但し書きが要る。

- **打ち切りでは `trap` が効かない。** hook が timeout で殺されるとプロセスごと終了し、`trap` で登録した `rmdir` は走らない。ロックが残ると以後の hook が毎回 2 秒待って諦め、集計が恒久的に止まる。
  そこで取得前に**作成時刻が 60 秒より古いロックは陳腐化とみなして消して取り直す**。60 秒は「正常な保持 (数十 ms)」より十分長く「打ち切られた hook のロック」を確実に拾う値。強制解放は必ずログに残す (黙って奪うと、本当に 2 プロセスが同時に加算して壊れたときに追えない)。
  PID を書いて生死で判定する案は `kill -0` や `/proc` が Git Bash で移植性を欠き、PID は再利用される
- **「ロックを諦めた」記録にロックが要る形にしない。** 諦めた回数を同じ JSON の中に持つと、その +1 にロックが要り循環する。記録先は 1 段目の追記専用ログ 1 か所に固定する

ヘルパ (`append_jsonl` / `json_write` / `lock` / `unlock`) を共有ライブラリに 1 組置き、各 hook が `>>` や `mv` や `trap` を自作しない。
閾値 (4 KB / 1 KB / 2 秒 / 60 秒) はヘルパの契約として 1 か所に持ち、呼び手が指定できる引数にしない (引数があると使われ、hook ごとに違う値が入る)。
`unlock` は冪等にする。

## 適用条件

- 効く: 複数の hook やサブエージェントが同じ記録ファイルに書く構成。JSONL の判定記録と JSON の集計を持つ hook 群
- 効かない: 1 本の hook しか書かないファイル。ロックを全ファイルに掛けると、全 hook が毎回書く記録がホットパスの直列化点になる

## トレードオフ

- 得る: 行が割れない、書きかけを読まない、加算が消えない、ロックの残置で集計が止まらない
- 失う: 4 KB 超の記録は切り詰められる。ロックを諦めた回は集計から 1 回抜ける (抜けたことは記録から分かる)
- 規則を仕様に書いただけでは守られない。「加算をロックで直列化する」と横断仕様に書いても、当該 hook の仕様に「ロック」の語が 1 つも無いまま実装に進んだ。
  競合する当人の仕様まで降ろす ([横断で決めた規則は個別の仕様まで降ろす](../workflow/push-cross-cutting-decisions-down-to-individual-specs.md))

## 関連

- [同じイベントの hook は並列に走り settings.json の配列順は実行順ではない](hooks-run-in-parallel-not-in-array-order.md)。競合の出所
- [タイムアウトした hook はガードにならず素通りする](hook-timeout-fails-open.md)。`trap` が効かない打ち切りの話
- [生成物を Git 管理下に置くかは人間が直接読むかで決める](../workflow/committed-vs-ignored-generated-files.md)。一時ファイル + rename の同じ書き方
