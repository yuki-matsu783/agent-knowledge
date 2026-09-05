---
type: pitfall
nature: fact
title: bash のパターン照合に入力由来の長い文字列を置くと二乗で遅くなる
description: >-
  Explains why a bash hook that redacts secrets before logging took 58 seconds on a 4,000-character
  input: `${s%%"$m"*}` with `$m` being a long literal taken from the input makes bash's pattern matcher
  cost input-length times pattern-length, and a `${s:i:1}` one-character loop is quadratic too; rewriting
  both as position-based scans brought the same rule to 101 ms. Also records the method that found it,
  timing each rule separately instead of guessing the regex rules were the slow ones, and measuring in a
  quiet machine after load skewed the numbers threefold. Use when a pure-bash hook is slow without any
  fork, or when a sanitizer's pattern grows with its input. Not for fork-cost problems, which are a
  separate budget.
tags: [claude-code, cost, workflow]
keywords: [bash, パターン照合, パラメータ展開, "${s%%pattern*}", 長いリテラル, O(n^2), 二乗, 58 秒, 101ms, 伏字化, redact, "${s:i:1}", 1 文字ループ, 位置ベース走査, 規則ごとに測る, ホットパス, 負荷中の測定]
status: stable
sources:
  - https://www.gnu.org/software/bash/manual/html_node/Shell-Parameter-Expansion.html
---

# bash のパターン照合に入力由来の長い文字列を置くと二乗で遅くなる

## 症状

hook が記録を書く前に秘密らしい語を伏字にする純 bash の関数が、4,000 文字の入力で **58 秒**かかった。
hook はツール呼び出しごとに 5 本並列で走るので、この形が残っていたら機構は実用にならなかった。fork は 1 つも無い。

## 原因

規則ごとに計測すると、正規表現を使う 4 規則はどれも 70 ms 程度で、犯人は 5 番目の規則の 1 行だった。

```bash
pre="${s%%"$m"*}"
```

`${s%%パターン*}` の `$m` が「入力に現れた文字列」で、入力と同じ長さ (ここでは 4,000 文字) まで伸びる。
bash のパターン照合のコストは入力長 × パターン長に効く。パターンが定数なら気にならないが、伏字化の対象は入力由来なので設計時の「パターンは短い」という暗黙の前提が崩れていた。この 1 行だけで 58,442 ms。

同じ性質のものが記録の切り詰め関数にもあった。`${s:i:1}` で 1 文字ずつ読むループは、bash では文字列の先頭から数え直すので O(n^2) になる。

## 回避策

- 長いリテラル (入力に由来する文字列) を `${s%%"$m"*}` / `${s##*"$m"}` のパターン位置に置かない。一致位置は位置ベースの走査で求める。書き直した結果は 101 ms (約 580 倍)
- `${s:i:1}` の繰り返しを書かない。切り詰めはパラメータ展開だけの O(n) にする
- ホットパスの文字列処理は「入力長に比例する時間で終わる形」を規約にする。実行時間の上限をテストで assert する案は、実行環境と負荷で揺れるので採らない。書き方の規約として持つ方が安定して守れる
- **性能の根拠は規則ごとに測ってから書く。** 全体の遅さから犯人を推測しない。今回は正規表現側を疑っていて、推測で直していたら 70 ms の側を最適化して終わっていた
- **他の重い処理を止めた状態で測る。** 全件テストを 2 本同時に走らせている最中の測定は「hook 1 回 1.9 秒」「テスト 5 分」という誤った値を記録した (静かな状態では 642 ms と 1 分 47 秒)

`sed` / `perl` に出す案は fork が 1 回増え、5 本並列ぶん効くので採らなかった。入力を先に切り詰めてから伏字化する案は、切り詰め位置が伏字の途中に来ると秘密の断片が残る。切り詰めは伏字化の後でなければならない。
長い入力のときだけ伏字化を諦める案は、長い入力ほど秘密が混ざる確率が高いので逆。

## 再現条件

bash 4 系 (Git Bash 同梱) で確認。GNU bash のパターン照合の実装に依存する挙動で、環境によって定数倍は変わるが二乗のオーダーは変わらない。

## 関連

- [ホットパスの hook は秒数ではなく fork の回数で予算を決める](count-forks-not-seconds-for-hot-path-hooks.md)。fork を数えても、これは別に見張る必要がある
- [並行する hook の記録は追記の行長制限と一時ファイルと mkdir ロックで守る](concurrent-hook-writes-append-tmpfile-mkdir-lock.md)。この伏字化の後ろにある切り詰めの話
- [hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒す](../20-PreToolUse/command-position-match-fails-closed.md)。正規化が特殊文字数に対して二乗になる別の例
