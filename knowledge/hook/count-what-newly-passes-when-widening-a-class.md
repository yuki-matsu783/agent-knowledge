---
type: pattern
nature: best-practice
title: 分類を広げるときは新たに通るものを数えるべき
description: >-
  A review discipline for default-deny guards: whenever a previously rejected path is admitted as a new
  class (curl allowed as "web" for declared investigation tickets), enumerate what the old blanket rejection
  had been blocking as a side effect and decide each item explicitly, because the same admission that fixes
  a false denial can silently open a remote-write route (curl -X POST creating issues) that the coarse rule
  used to close. Also covers the inverted state that motivated the change (the logged tool blocked, the
  unlogged tool passing) and why the fix must be an ordered check with the strongest denial first. Use when
  relaxing any classifier, allowlist, or matcher in a guard. Not for adding new denials, which only narrow.
tags: [security, workflow]
keywords: [分類, 白名簿, 緩和, 既定拒否, 新たに通るもの, 副作用として塞がれていた, curl, web, 送信側, リモート書き込み, WebFetch, 記録が残る側, 倒錯, 順序付き判定, 2 巡目で 3 回]
status: stable
sources: []
intervention: human
---

# 分類を広げるときは新たに通るものを数える

## 課題

`curl` / `wget` が「どの分類にも当たらない = 既定拒否」で塞がれていた一方、`WebFetch` ツールは matcher の外で記録すら残さずに通っていた。
**記録が残る側だけが塞がれ、記録が残らない側が素通りする**倒錯で、調査タスクは公式ドキュメントを `curl` で落として読むのが本体なので、実害も出ていた。

そこで `curl` / `wget` を `web` の分類にして「調査チケットが宣言していれば通る」と改めた。出力先オプション (`-o` など) は書き込みとして判定する、と書き込みの穴には気を配った。
次のレビューで、**送信側**が勘定されていないことが分かった。`curl -T a.md <url>`、`-d @a.md`、`-F file=@a.md`、`-X POST https://api.github.com/repos/…/issues`。
どれもリモートへの書き込みそのもので、改定前は `curl` が丸ごと拒否だったので閉じていた経路が、宣言だけで通るようになっていた。

同じ形の見落としが同じレビューで 3 回見つかった。

## 解決

- **分類を足す・緩めるときは「今まで塞がっていたもののうち、何が通るようになるか」を列挙する。** 乱暴な既定拒否は、意図していない経路も副作用として塞いでいる。緩和はその副作用ごと外す
- 列挙したものを判定に組み込むときは**順序付き**にし、最も強い拒否を先に置く。「送信側かつ出力先あり」のような複合形があるので独立した条件では表せない
  1. 送信側の形 → 宣言の有無によらず拒否 (リモート書き込みの識別子を再利用する。新しい番号を作る理由が無い)
  2. 出力先を持つ形 → 出力先パスに書き込みの判定を当てる
  3. 残りが `web`。宣言と上限の両方にあれば許可、無ければ拒否
- 倒錯を正す方向は 1 つしかない。「記録が残る側 (`curl`) を通す」であって「記録が残らない側 (`WebFetch`) も止める」ではない。後者は判定モデルが違い (コマンド列の分類をツール名だけの入力に当てられない)、止めた場合の害が守る利益を上回る
- 改定の DDR には、検討しなかった側面 (送信側) を後から追記し、根拠の「抜け道が残る」のような偽の記述は削る。根拠が偽のまま決定だけ残すと、後から読む人が同じ判断を再現できない

## 適用条件

- 効く: 既定拒否の guard で、分類・白名簿・matcher を「通す側」に動かす変更。特に元の拒否が粗かった場合ほど副作用の範囲が広い
- 効かない: 拒否を足す変更。狭める方向は新たに通るものを作らないが、こちらは「狭めた結果こぼれるもの」を先に列挙する ([コマンド判定](command-position-match-fails-closed.md) の教訓)

## トレードオフ

- 得る: 緩和のたびに統制の穴が開く型の事故が減る。列挙が残るので、後のレビューが「何を通したか」を確かめられる
- 失う: 緩和 1 件に付き検討項目が増える。オプション体系を持つコマンド (`curl` / `git`) は列挙が長い

## 関連

- [読み取り専用に分類したコマンドはオプションで状態を変えたり任意実行したりする](read-only-command-classes-have-option-holes.md)。列挙した結果の一覧
- [横断で決めた規則は個別の仕様まで降ろす](../workflow/push-cross-cutting-decisions-down-to-individual-specs.md)。同じレビューで見つかったもう 1 つの型
- [hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒す](command-position-match-fails-closed.md)。逆向き (狭める変更) の同じ規律
