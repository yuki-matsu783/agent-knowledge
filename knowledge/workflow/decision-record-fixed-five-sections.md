---
type: pattern
nature: heuristic
title: 決定記録は背景・決定・理由・却下した案・影響の 5 節に固定するとよさそう
description: >-
  Fixes the section layout of a decision record to five headings, 背景 (context) / 決定 (decision) /
  理由 (rationale) / 却下した案 (rejected alternatives) / 影響 (impact), so that an agent writing one
  records the reasoning and the discarded options instead of the conclusion alone, and so that the
  impact section forces every downstream document to be enumerated. Use when setting up or writing
  architecture and spec decision records (ADR / DDR) in a repository that agents both write and read.
  Not for where to place the records (see the colocation note) and not for the general ADR template
  debate. Verified only as the practice of another agent-maintained repository running 150+ records;
  nothing has been run this way here.
tags: [workflow, context-management]
keywords: [決定記録, 決定ログ, ADR, DDR, 節構成, 背景, 決定, 理由, 却下した案, 影響, 却下案, 影響の列挙, 経緯, 判断の再現, 固定見出し, superseded_by, superseded_scope, 1 決定 1 ファイル]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
  - https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
  - https://adr.github.io/
intervention: prompt
---

# 決定記録は背景・決定・理由・却下した案・影響の 5 節に固定するとよさそう

## 課題

決定記録に何を書くかを決めずに書き始めると、**結論だけが残る。**
仕様書の「設計判断」節がそうなっている。「こうする」は書けるが、何を検討して捨てたか、どの制約が効いていたかは落ちる。

書かれていない制約は、次に読む側にとって存在しないのと同じになる。エージェントはセッションをまたいで覚えていないので、
渡した文書が入力の全部になり、既に却下した案に戻る・設計を支えていた制約に気付かず壊す、が繰り返し起きる。

節を決めないと書き手ごとに粒度も揺れる。日をまたいで別のエージェントが書いた記録が同じ形で読めない。

## 解決

節は次の 5 つに固定する。増やさない、減らさない、順番も変えない。

| 節 | 書くこと |
|---|---|
| 背景 | その決定が必要になった状況と制約。何が問題だったか |
| 決定 | 決めたこと。現在有効な内容だけ。断定形で 1 つ |
| 理由 | その案を選んだ根拠。前提が崩れたときに読み直せるように、根拠を明示する |
| 却下した案 | 検討して捨てた案と、捨てた理由。理由まで書く |
| 影響 | この決定を降ろす先の文書を列挙し切る (下記) |

「影響」には 4 種類を漏らさず書く
([横断で決めた規則は個別の仕様まで降ろすべき](push-cross-cutting-decisions-down-to-individual-specs.md))。

1. その規則が現れる個別の仕様書
2. 対応する要件書 (外から見える振る舞いが変わる場合)
3. 同じ事実を再掲している表・一覧 (分類表、語彙表、識別子の台帳)
4. その規則を根拠にしている既存の決定記録

列挙し切れば `grep` で確かめられる。決定に関係する語で検索して影響に無い文書が出たら取りこぼし。

節構成に付いてくる運用が 3 つある。

- **1 決定 1 ファイル。** 1 ファイルに複数の決定を積むと、どの節がどの決定のものか分からなくなる。
  ID は連番にしない ([連番 ID はブランチ並行で必ず衝突し git はそれを報告しない](sequential-ids-collide-across-branches.md))
- **マージ後は本文を書き換えない。** 無効化は frontmatter の `status` と `superseded_by` で表す。
  部分的に覆ったときは置き換え側の記録を足し、`superseded_scope` にどの範囲が無効かを書く。
  「決定」節だけ読むと現在の実装を誤解する状態は、置き換え記録を足すことでしか解けない
- **根拠が偽になったら根拠を直す。** 改定のときは検討しなかった側面を追記し、偽になった根拠は削る。
  決定だけ残して根拠が偽のままだと、後から読む側が同じ判断を再現できない
  ([分類を広げるときは新たに通るものを数える](../hooks/20-PreToolUse/count-what-newly-passes-when-widening-a-class.md))

書き手はエージェント。決定した直後に、設計書と同じチケットの中で書く。

## 適用条件

- 効く: 設計文書をエージェントが書き、別のセッションのエージェントが読んで直す運用。150 件超をこの形で回している例がある
- 効く: 共通仕様 + 個別仕様の 2 層構成。「影響」節が層をまたぐ取りこぼしを塞ぐ
- 効かない: 決定が 1 桁しかない小さなリポジトリ。5 節が記録そのものより長くなる
- 効かない: 設計書に履歴を持たせる構成。決定記録と changelog が二重になる。仕様書の「影響範囲」節に issue ごとの
  changelog を積み上げて 4,600 行に達し Read の上限を超えた例がある

## トレードオフ

- 得る: 却下案が残るので同じ議論を繰り返さない。「影響」節がチケット完了時の `grep` 自己点検のリストになる
- 失う: 決定 1 件あたりの分量が増える。とくに影響の列挙は決定が横断的なほど長くなる
- 未解決: **却下案を書くと逆に拾い直される可能性がある。** 却下理由まで書けば防げるのか、そもそも書かない方がよいのかは分かっていない

## 関連

- [設計書の隣に決定ログを置くとよいはず](decision-log-beside-design-docs.md)。この 5 節をどこに置くかの話
- [横断で決めた規則は個別の仕様まで降ろすべき](push-cross-cutting-decisions-down-to-individual-specs.md)。「影響」節の粒度の根拠
- [連番 ID はブランチ並行で必ず衝突し git はそれを報告しない](sequential-ids-collide-across-branches.md)。1 決定 1 ファイルの ID の付け方
