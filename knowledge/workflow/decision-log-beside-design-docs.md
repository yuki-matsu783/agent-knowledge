---
type: note
nature: opinion
title: 設計書の隣に決定ログを置くとよいはず
description: >-
  Proposes keeping an append-only decision log in the same directory as the design documents it
  explains, so that an agent editing the design later can see why the current shape was chosen and
  which alternatives were already rejected. Design docs are a snapshot of the present state and lose
  the reasoning behind it; the reasoning is flow-shaped and belongs in a separate append-only file,
  but colocated rather than in an issue tracker, a wiki, or git history, because an agent reads what
  is next to the file it already opened. Use when deciding where to record architecture and spec
  decisions in a repository that agents edit. Includes how another agent-maintained repository runs
  150+ such records (one file per decision, issue-number ids, specs hold only the current truth,
  superseding instead of editing, an impact section that lists every place the decision must reach).
  Not for the general ADR template question (see the ADR sources), and not verified here: nothing has
  been run this way in this repository.
tags: [workflow, context-management]
keywords: [決定ログ, 決定記録, ADR, DDR, 設計書, 経緯, 意思決定, 却下案, スナップショット, ストックとフロー, コロケーション, 同一ディレクトリ, 追記式, 手戻り, git log, 正史, superseded_by, 影響の列挙, changelog 化]
status: stable
sources:
  - https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
  - https://adr.github.io/
  - .claude/rules/repo-docs.md
---

# 設計書の隣に決定ログを置く

## 思いつき

設計書には「今こうなっている」しか書いていない。**そうなった経緯は書かれない。**
なぜその案を選んだのか、何を検討して捨てたのか、どの制約が効いていたのかが残らない。

次に直すときにこれが効いてくる。書かれていない制約は、読む側にとって存在しないのと同じなので、

- 既に検討して却下した案に戻る
- 設計を支えていた制約に気付かず壊す
- 同じ議論をもう一度する

エージェントが相手だとこれが毎回起きる。人は「前にそれを試して駄目だった」を覚えているが、
エージェントはセッションをまたいで覚えていない
([タスクの切れ目で /compact と /clear をユーザに依頼させる](../rule/ask-user-to-reset-context-at-task-boundaries.md)
のように、そもそも意図的に忘れさせている)。渡した設計書が入力の全部になる。
だから**経緯を人の頭ではなくファイルに置く**必要がある。

## ストックとフローを 1 つのファイルに混ぜない

書き方の性質が違う 2 種類がある。

| | 設計書 | 決定ログ |
|---|---|---|
| 性質 | ストック (現在断面) | フロー (時系列) |
| 更新 | 上書きする | 追記する。過去の行を書き換えない |
| 読む場面 | 実装するとき | 設計を変えるとき |
| 増え方 | 増えない (書き換わる) | 単調に増える |

設計書の中に「以前は X だったが Y に変えた」と履歴を足していくと、現在断面が読めなくなる。
上書きするものと追記するものは別ファイルに分ける。

## 置き場所の候補

フロー資料なので、リポジトリの外で管理する手はある。ただしエージェントから読めるかで差が出る。

| 置き場所 | エージェントから読めるか | 設計書との対応 |
|---|---|---|
| issue / PR のコメント | 追加の取得手段 (gh CLI、MCP、API) が要る。認証も要る | 人がリンクを辿って探す |
| 外部の wiki | 同上。取れないこともある | 弱い |
| リポジトリ内の専用ディレクトリ (`decisions/` など) | 読める | ディレクトリが離れる分、辿るのに 1 手増える |
| **設計書と同じディレクトリ** | 読める | 同じ glob で拾える。設計書を開いた流れでそのまま読める |

同じディレクトリに置くのが一番安い。エージェントは**既に開いたファイルの隣**を読む。
`.claude/docs/10_spec/xlsx-export.md` を読ませたときに、
`.claude/docs/10_spec/xlsx-export.decisions.md` が並んでいれば探させる必要がない。

## git history では代わりにならない

「経緯は git が持つ」は半分しか正しくない。git が持つのは**何が変わったか**であって、
なぜその案を選んだか・何を却下したかは commit message に書かない限り残らない。
書いたとしても、読むには `git log -p` で diff を遡る必要がある。
エージェントにそれをやらせるのは、決定ログ 1 本を読ませるより高くつく。

このリポジトリの規約が本文に履歴を書かせない
([knowledge-authoring.md](../../.claude/rules/knowledge-authoring.md)「変更の経緯は git が持つ」) のは
knowledge の話で、そこでは経緯そのものが価値を持たない。設計書は逆で、経緯が次の判断の材料になる。

## このリポジトリに当てはめると

決定を置く場所が無い。`.claude/docs/10_spec/` にあるのは道具の仕様だけで、
**設計判断の経緯はどこにも残っていない。**

spec には「設計判断」の節があるが、そこに書けるのは結論だけで、却下案と時系列は落ちる。
適用するなら spec と同じディレクトリに `<slug>.decisions.md` を並べる形になる。
決定記録専用のディレクトリを別に持たない構成なので、この方針と衝突するものは無い。

## 別のリポジトリで運用されている形

エージェントが要件書・仕様書・決定記録 (DDR) を書くリポジトリが 150 件を超える決定記録を運用しており、上の未決事項のいくつかに答えが出ている。

- **粒度は 1 決定 1 ファイル。** ID は issue 番号 + 枝番 (`i0009-58`) で、ディレクトリは設計書と同じ階層の隣 (`00_requirement/` `10_spec/` `20_ddr/`)。
  連番にしない理由は [連番 ID はブランチ並行で必ず衝突し git はそれを報告しない](sequential-ids-collide-across-branches.md)
- **設計書には現在有効な内容だけを書く。** 変更履歴・レビュー記録の表を持たない。前身のプロジェクトは仕様書の「影響範囲」節に issue ごとの
  changelog を積み上げて 4,600 行に達し、Read の上限を超えた。「いつ何が変わったか」は git と MR、「なぜ」は決定記録、と役割を分けた
- **無効化は本文を書き換えず、frontmatter の `status` と `superseded_by` で表す。** マージ後の本文は不変。決定が部分的に覆ったときも
  置き換え側の記録を足して、`superseded_scope` に「どの範囲が無効か」を書く。「決定」節だけ読むと現在の実装を誤解する状態は、置き換え記録を足すことでしか解けない
- **書くのはエージェント。** 決定の直後に、設計書と同じチケットの中で書く。節は 背景 / 決定 / 理由 / 却下した案 / 影響 の固定 5 つ
- **「影響」節に降ろす先を列挙し切る。** 横断の文書で決めた規則が個別の仕様に降りていない取りこぼしが、レビュー 2 巡で閉じ切れなかった 7 件すべての型だった。
  影響には、規則が現れる個別仕様・対応する要件書・同じ事実を再掲している表・根拠にしている既存の決定記録の 4 種類を書く。列挙し切れば `grep` で確かめられる
- 却下案の副作用については記録が無い。少なくとも「却下理由の前提が後で崩れた」ときに、却下案を復活させる決定 (並列実施の再採用) が書けている

## 確かめていないこと

- **このリポジトリではやっていない。** 決定ログがあったおかげで次の修正が正しい方向に行った、という例をまだ持っていない
- **トークンの代償を測っていない。** 同じディレクトリに置くと、設計書だけ読めばよい場面でも決定ログが一緒に載る。
  上の運用例は決定記録を別ディレクトリ (`20_ddr/`) に分けているので、同一ディレクトリ案の代償はそこからも分からない
- **却下案の副作用が読めない。** 「却下した」と明記しても、エージェントが選択肢として拾い直す可能性がある。
  却下理由まで書けば防げるのか、そもそも却下案は書かない方がよいのかが分からない

## 昇格の目安

(.claude/rules/knowledge-authoring.md「note を昇格させる」)。満たしたら type を変える。ファイルは動かさない。

- [ ] 粒度が type の定義に収まっている → 「課題と解決」の形なので `pattern` になる見込み
- [x] sources に一次情報がある → ADR の原典 (Nygard) と adr.github.io
- [ ] 実際に試して applies_to と verified_at を書ける → このリポジトリの `.claude/docs/` で 1 本運用してみる
