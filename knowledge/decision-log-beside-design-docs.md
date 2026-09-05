---
type: note
title: 設計書の隣に決定ログを置く
description: >-
  Proposes keeping an append-only decision log in the same directory as the design documents it
  explains, so that an agent editing the design later can see why the current shape was chosen and
  which alternatives were already rejected. Design docs are a snapshot of the present state and lose
  the reasoning behind it; the reasoning is flow-shaped and belongs in a separate append-only file,
  but colocated rather than in an issue tracker, a wiki, or git history, because an agent reads what
  is next to the file it already opened. Use when deciding where to record architecture and spec
  decisions in a repository that agents edit. Not for the general ADR template question (see the ADR
  sources), and not verified: nothing here has been run in a real repository.
tags: [workflow, context-management]
keywords: [決定ログ, 決定記録, ADR, 設計書, 経緯, 意思決定, なぜ, 却下案, スナップショット, ストックとフロー, コロケーション, 同一ディレクトリ, 追記式, 手戻り, デグレ, git log]
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
([タスクの切れ目で /compact と /clear をユーザに依頼させる](ask-user-to-reset-context-at-task-boundaries.md)
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
([knowledge-authoring.md](../.claude/rules/knowledge-authoring.md)「変更の経緯は git が持つ」) のは
knowledge の話で、そこでは経緯そのものが価値を持たない。設計書は逆で、経緯が次の判断の材料になる。

## このリポジトリに当てはめると

決定を置く場所が無い。`.claude/docs/10_spec/` にあるのは道具の仕様だけで、
**設計判断の経緯はどこにも残っていない。**

spec には「設計判断」の節があるが、そこに書けるのは結論だけで、却下案と時系列は落ちる。
適用するなら spec と同じディレクトリに `<slug>.decisions.md` を並べる形になる。
決定記録専用のディレクトリを別に持たない構成なので、この方針と衝突するものは無い。

## 確かめていないこと

- **実際にやっていない。** 決定ログがあったおかげで次の修正が正しい方向に行った、という例をまだ持っていない
- **トークンの代償を測っていない。** 同じディレクトリに置くと、設計書だけ読めばよい場面でも決定ログが一緒に載る。
  決定が積み上がるほど重くなる。どこで折り返して要約するかの閾値が分からない
- **粒度を決めていない。** 決定 1 件 1 ファイル (ADR 方式) か、設計書 1 本につき決定ログ 1 本の追記式か。
  後者の方が隣接性は高いが、1 ファイルが際限なく伸びる
- **誰が書くかを決めていない。** エージェントに書かせると、決定した本人ではないので推測が混ざる。
  人が書くと書かれない
- **却下案の副作用が読めない。** 「却下した」と明記しても、エージェントが選択肢として拾い直す可能性がある。
  却下理由まで書けば防げるのか、そもそも却下案は書かない方がよいのかが分からない
- **無効になった決定の扱い。** 追記式なので古い決定が残り続ける。現役の決定と読み分けさせる仕掛けが要る

## 昇格の目安

(.claude/rules/knowledge-authoring.md「note を昇格させる」)。満たしたら type を変える。ファイルは動かさない。

- [ ] 粒度が type の定義に収まっている → 「課題と解決」の形なので `pattern` になる見込み
- [x] sources に一次情報がある → ADR の原典 (Nygard) と adr.github.io
- [ ] 実際に試して applies_to と verified_at を書ける → このリポジトリの `.claude/docs/` で 1 本運用してみる
