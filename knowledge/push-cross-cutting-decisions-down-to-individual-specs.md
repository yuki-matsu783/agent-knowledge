---
type: pattern
title: 横断で決めた規則は個別の仕様まで降ろす
description: >-
  A documentation discipline learned from two review rounds where every unresolved finding had the same
  shape, a rule settled in the cross-cutting spec but still contradicted in the per-hook spec, the
  requirement, a summary table, or an older decision record: when a decision changes a shared rule, its
  impact section must enumerate all four kinds of places the rule reaches, every reprinted table must say
  where the canonical copy lives, and renumbering a numbered section must fix its references in the same
  change because a number is a position, not a name. Use when a rule is written once for many components,
  or when a spec says "as in section X" and the implementer reads only their own file. Not for what to put
  in a decision record in general.
tags: [workflow, meta]
keywords: [横断仕様, 個別仕様, 要件, 降ろす, 影響の列挙, 再掲, 正は 1 か所, 取りこぼし, 番号は名前ではない, 制御方式, 繰り下げ, grep, 決定記録, 同じ型, 2 巡]
status: stable
sources: []
---

# 横断で決めた規則は個別の仕様まで降ろす

## 課題

hook 11 本に共通する規則を 1 本の「共通仕様」に集め、各 hook の仕様は個別の判定だけを書く構成にしていた。
レビュー 1 巡目の 38 件のうち閉じ切れなかった 7 件が**すべて同じ型**だった。横断の共通仕様では閉じたが、実装される側の個別仕様や要件書で閉じていない。

その 7 件を直すために書いた決定 (`curl` を機構が強制する分類に加える) 自体が、また同じ型を作った。共通仕様と guard の仕様は更新したのに、
調査タスクの要件書には「この禁止は機構では強制されず自制による」という逆の記述が残り、ライブラリの分類表には新しい分類が無いままだった。

同じことが数値でも起きた。「集計の加算をロックで直列化する」と共通仕様の並行書き込みの節に書き、決定の影響にも hook 名を挙げたが、**その hook の仕様に「ロック」の語は 0 件**のまま実装に進んだ。
hook 本体を書く人が読むのは個別仕様で、そこに無ければ素の `>>` で書く実装になる。

## 解決

- **決定の「影響」節に、降ろす先を列挙し切る。** 対象は 4 種類
  1. その規則が現れる個別の仕様書
  2. 対応する要件書 (外から見える振る舞いが変わる場合)
  3. 同じ事実を再掲している表・一覧 (分類表、語彙表、識別子の台帳)
  4. その規則を根拠にしている既存の決定記録
  列挙し切れば `grep` で確かめられる。「この決定に関係する語」で検索して影響に無い文書が出たら取りこぼし。チケット完了時の自己点検に使える
- **再掲する表には「正は共通仕様の §X」と書く。** 責務の境界を示すための要約は残してよいが、正の所在を明示する。再掲を全面的に禁じると個別仕様が読み物として成立しなくなる
- **番号は名前ではない。** 「制御方式 4」は位置を指すだけで何を判定するかを含まない。分岐を途中に挿入して番号を繰り下げたら、**同じ変更の中で**その文書内の参照 (要件との対応表、テスト観点) と他文書からの参照を `制御方式 <番号>` で `grep` して直す。
  番号を持つ節を新設するときは末尾に足せるなら末尾に足す。判定順に意味があって途中に入れるしかないときだけ繰り下げる
- 決定記録の節構成は変えない。「影響」は既にある節で、そこに書く内容の粒度を決めるだけ

機械検査は作らない。「同じ語が複数文書にあれば警告」は正当な再掲と取りこぼしを区別できず、「制御方式 5 が文書の数を超えていないか」は 4 と 5 を取り違えても両方存在するので検出できない。

## 適用条件

- 効く: 共通仕様 + 個別仕様の 2 層で書かれた設計文書を、エージェントが更新する運用
- 効かない: 横断文書を廃止して個別仕様だけにする案。共通の規則が 11 本に散らばり、変更のたびに 11 か所を直す。「正は 1 か所」の逆行

## トレードオフ

- 得る: 「横断では閉じたが個別で閉じていない」型の再発が減る。チケット完了時に `grep` で自己点検できる
- 失う: 決定 1 件あたり影響の列挙が長くなる。番号の繰り下げが起きる変更は参照の追従が付いて回る

## 関連

- [設計書の隣に決定ログを置く](decision-log-beside-design-docs.md)。決定記録の「影響」節の位置づけ
- [並行する hook の記録は追記の行長制限と一時ファイルと mkdir ロックで守る](concurrent-hook-writes-append-tmpfile-mkdir-lock.md)。ロックの語が 0 件だった規則
- [分類を広げるときは新たに通るものを数える](count-what-newly-passes-when-widening-a-class.md)。同じレビューで見つかったもう 1 つの型
- [コピーした定型行はバイト一致をテストで固定する](test-byte-equality-of-copied-boilerplate.md)。コードにおける同じ「雛形だけ直して波及を見ない」
