---
type: how-to
nature: best-practice
title: 要件書は背景・外部要求・ハッピーパス・適用範囲外・受け入れ条件の 5 節で書くべき
description: >-
  End-to-end procedure for writing a requirements document that an agent will implement against,
  and that a separate reviewer will judge acceptance by: fix the reader, write the background, list
  the external requirements in EARS form with ids and a fixed subject, draw only the happy path,
  state what is out of scope, and close with acceptance criteria runnable as one command. Covers the
  five EARS types with what each is for, the id scheme, the words to avoid, and how each section
  maps to a test. Use when starting a requirements document for a tool or a feature that an agent
  will build. Not for the specification that sits beside it, not for deciding whether to separate
  the two documents at all, and not for the acceptance test code itself.
tags: [workflow, evaluation]
keywords: [要件, requirement, 要件書, EARS, ユビキタス, イベント駆動, 状態駆動, 望ましくない挙動, オプション, 背景, 外部要求, ハッピーパス, 適用範囲外, 受け入れ条件, ID, 主語, 曖昧語, 5 節, 仕様, spec]
status: stable
verified_at: 2026-09-06
sources:
  - https://alistairmavin.com/ears/
  - https://ieeexplore.ieee.org/document/5328509
  - .claude/rules/repo-docs.md
intervention: prompt
---

# 要件書は背景・外部要求・ハッピーパス・適用範囲外・受け入れ条件の 5 節で書くべき

## 前提

- 実装をエージェントに任せ、内部の挙動と設計判断は仕様書に別で持つ構成を想定する。1 ファイルにまとめる場合も節が分かれていれば同じ手順で書ける
- 外部要求は EARS (Easy Approach to Requirements Syntax) で書く。5 つの型に当てはめる形式で、自然言語のまま曖昧さを減らせる
- 作る対象そのものが LLM エージェントの場合は、この 5 節に 4 節を足す。追加分は [実装対象がエージェントの要件書は個別の入出力ではなく分布と失敗モードと前提の破れで書くべき](requirements-for-agent-as-the-target.md)
- 節の順序に意味がある。上から読むと「なぜ要るか」「何を約束するか」「うまくいくとどう動くか」「何を約束しないか」「どう合格を判定するか」になる

## 手順

**1. 読み手を 2 人に固定する。** 実装するエージェントと、受け入れを判定する側。
判定する側にこの文書だけを渡して合否が出せるかが、以降すべての節の基準になる。
判定する側が実装の理屈を読まずに済むので、実装に合わせた甘い判定になりにくい。

**2. 背景を 1〜2 段落で書く。** 何に困っていたか、何を手放したくないか。
**理由を書いてよいのはこの節だけ。** ここで書き切ると、以降の節に理由が漏れなくなる。実装の理由 (ライブラリの都合、処理の順序) はここにも書かない。

**3. 外部要求を EARS の表で書く。** ID・型・要求文の 3 列。型は 5 つから選ぶ。

| 型 | 書き方 | 何に使うか |
|---|---|---|
| ユビキタス | 〜は、…すること | 常に成り立つ不変条件。出力物の性質はここ |
| イベント駆動 | …したとき、〜は、…すること | 入力に対する応答。ハッピーパスの本体 |
| 状態駆動 | …の間、〜は、…すること | ある状態が続く間だけ成り立つもの。実行環境の条件など |
| 望ましくない挙動 | もし…ならば、〜は、…すること | 要求由来の異常系。実装が 1 行も無くても書ける |
| オプション | …する場合、〜は、…すること | 特定の構成のときだけ有効なもの |

- ID は `REQ-<3 文字>-<連番>` の形。3 文字は対象の略号にする
- **主語は対象の名前で固定する。** 「xlsx 生成は」「変換は」。「システムは」にすると何を約束したか追えなくなる
- 1 要求 1 文。接続詞で 2 つ繋いだら分ける
- 「適切に」「必要に応じて」「高速に」は判定できないので使わない。速さを約束するなら数値を書く

**4. ハッピーパスを mermaid で描く。** 成功する筋道だけを描き、エラー分岐は書かない。
分岐は「望ましくない挙動」の要求が持っているので、図に入れると二重管理になる。
1 枚 4〜6 ノードに収め、超えたら工程で切って複数枚にする。

**5. 適用範囲外を書く。** できないこと、やらないこと、ライセンス上の制約。
**この節は受入テストから復元できない。** 「やらない」はテストにならないので、要求を削るときもここは削らない。

**6. 受け入れ条件を書く。** 外から確認できる合格条件を箇条書きで。
1 本はコマンド 1 つで回る形にする。これが完了判定の達成型になる ([完了条件は達成型・収束型・判定型に分けて達成型だけを Stop hook に置いた方がよさそう](three-types-of-completion-conditions.md))。

**7. 削る。** 書き終えてから 2 段のフィルタをかけて絞る。手順は
[要件書は外から観測できて消すと困る文だけに絞るとよさそう](requirements-hold-only-externally-observable-statements.md)。

## 確認方法

- **1 文ずつ観測できるか問う。** 対象の中身を一切知らない人が、その文の真偽を判定できるか。できないなら仕様書へ移す
- **実装を差し替えたと仮定する。** ライブラリや言語を変えたときに書き直しが要る文があれば、そこに内部が漏れている
- **型とテストの形が対応するか見る。** ユビキタスは不変条件、イベント駆動は入力と出力の照合、状態駆動は事前状態を作ってから、望ましくない挙動は要求由来の異常系、オプションは条件付き実行。対応が付かない文は要求の書き方がずれている
- **受け入れ条件がコマンド 1 本で回るか確かめる。** 回らないなら、判定する側が毎回文書を読んで解釈することになる

## つまずきどころ

- **背景に実装の理由を書いてしまう。** 背景は「何に困っていたか」まで。「だから openpyxl を選んだ」は仕様書の設計判断へ
- **工程を追って書いて要求が増える。** 「表を拾う」「名前を整える」「書式を当てる」は成果物 1 つの性質なので 1 文にまとまる
- **番号を名前として参照する。** 「REQ-XLS-03 のとおり」と別文書から参照すると、繰り下げたときに黙って別の要求を指す。参照は番号ではなく内容で書く ([横断で決めた規則は個別の仕様まで降ろすべき](push-cross-cutting-decisions-down-to-individual-specs.md))
- **連番をブランチをまたいで振る。** 並行して要求を足すと同じ番号が 2 か所で生まれる ([連番 ID はブランチ並行で必ず衝突し git はそれを報告しない](sequential-ids-collide-across-branches.md))
- **ハッピーパスにエラー分岐を描く。** 図と「望ましくない挙動」の要求が二重管理になり、片方だけ直る
- **要求の数だけテストを書こうとする。** 要求の数はテストの本数を決めない。詳細は [エージェントに実装させる前に外から観測できる受入テストを書くとよいはず](acceptance-test-before-agent-implementation.md)
