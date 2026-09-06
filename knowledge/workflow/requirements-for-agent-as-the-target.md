---
type: how-to
nature: best-practice
title: 実装対象がエージェントの要件書は個別の入出力ではなく分布と失敗モードと前提の破れで書くべき
description: >-
  How to write requirements when the thing being built is itself an LLM agent, whose output is
  non-deterministic and therefore cannot be pinned by per-case pass/fail statements. Splits the
  document into the deterministic half (tools, permissions by reversibility, caps) that ordinary
  EARS still covers, and four sections the deterministic form cannot express: a failure-mode table
  pairing each agent-specific failure with both a countermeasure and a detector, quality criteria
  stated as a distribution with the cost asymmetry spelled out, domain assumptions that no test can
  check and so are watched at runtime, and acceptance examples given as typical, boundary, and
  adversarial cases judged by a rubric. Use when writing requirements for a chat, support, or
  workflow agent. Not for requirements of a deterministic tool, and not for the eval harness itself.
tags: [workflow, evaluation, security]
keywords: [エージェント, 要件, requirement, 非決定, 分布, 失敗モード, 幻覚, プロンプトインジェクション, コスト暴走, 検知, ドメイン仮定, 前提の破れ, 実行時監視, 品質基準, 誤りの非対称, ルーブリック, 敵対的, 評価セット, エスカレーション, 可逆性]
status: stable
verified_at: 2026-09-06
sources:
  - https://www.anthropic.com/engineering/building-effective-agents
  - https://genai.owasp.org/llm-top-10/
  - https://alistairmavin.com/ears/
intervention: prompt
---

# 実装対象がエージェントの要件書は個別の入出力ではなく分布と失敗モードと前提の破れで書くべき

## 前提

- 作る対象が LLM エージェントで、同じ入力に対して出力が毎回同じとは限らない場合を指す。決定的な道具の要件書は
  [要件書は背景・外部要求・ハッピーパス・適用範囲外・受け入れ条件の 5 節で書くべき](write-requirements-in-five-sections.md) の 5 節で足りる
- 5 節はそのまま使い、置き換えではなく追加として 4 節を足す。**「この入力でこう出ること」で書けない部分だけを別の形に逃がす**
- 評価セットと、それを回す仕組みが先にあること。分布で書いた基準は、回す先が無いと判定できない

## 手順

**1. 決定的な部分を先に書き切る。** ツールの一覧、権限、上限値、エスカレーションの発火条件は、
非決定なのは判断だけで、外形は決定的に書ける。ここは通常の EARS でイベント駆動と望ましくない挙動として書く。
残った「判断」と「生成した文」だけが以降 4 節の対象。

**2. 権限を副作用の可逆性で 3 分類する。** 自律実行してよいもの、人の確認が要るもの、禁止するもの。
線引きの根拠は [エージェントに任せる操作と人間承認が要る操作の線引きは可逆性で決めるべき](reversibility-decides-who-acts.md)。
禁止はツールを渡さないことで担保すると明記する。プロンプトは二重の防御として書く。

**3. 失敗モードを表で書く。** 列は 失敗モード・対策・検知の 3 つ。**対策だけの行を作らない。**
検知が無い対策は祈りで、非決定な相手には効かない ([本当に守らせたい内容は指示側の誘導と出力側の検査を対で置かないといけない](pair-steering-with-output-check.md))。
エージェント固有の類型は次の 4 つで、通常のバグとは性質が違う。

| 類型 | 中身 |
|---|---|
| 事実の生成 | 参照元に無い値を作る。日付、金額、識別子 |
| 入力中の指示への追従 | 利用者の入力に含まれた文を指示として実行する |
| ループとコストの暴走 | ツール呼び出しが収束せずトークンを使い切る |
| 確認を要する行動の無確認実行 | 要確認の分類を飛ばして副作用のある操作を行う |

**4. 品質基準を分布で書く。** 個別の入出力ではなく、評価セットに対する率で規定する。
そのうえで**誤りのコストの非対称を本文に明記する。** 取り返しがつかない項目だけ 0 件と書き、残りは率と、その率にした根拠を書く。
非対称が書かれていないと、実装側は総合精度を最大化する側に寄せる。過剰なエスカレーションは安く、誤った自律実行は高い。

**5. ドメイン仮定を表で書く。** 列は 仮定・破れたときの影響・検知方法の 3 つ。
システムの外側の前提はテストで検証できないので、実行時の監視に回す。
モデルのバージョン、評価セットが実分布を代表していること、外部 API の正しさ、入力言語がここに入る。
書き方は [実測の前に外れたときの縮退が書かれているべき](write-fallback-condition-before-measuring.md) と同じで、
**破れたときにどうなるかを先に書く。**

**6. 受け入れ基準は 3 例に絞りルーブリックで判定する。** 典型・境界・敵対的の 1 例ずつを本文に置き、網羅は評価セットに委ねる。
敵対的の例は必ず 1 つ置く。完全一致では判定できないので、判定基準は別ファイルのルーブリックにする。

**7. パラメータを 1 つの表に集める。** 上限ターン数、呼び出し回数、猶予、評価セットの件数。
本文では値ではなく名前で参照する。値が本文と表の両方にあると、変えたとき取り残される。

## 確認方法

- **失敗モード表とドメイン仮定表の全行に検知が入っているか。** 空欄が 1 つでもあれば、そこは運用で気づけない
- **0 件と書いた項目が本当に取り返しがつかないか。** 元に戻せるなら率でよい。0 件が増えるほど基準全体が達成不能に寄る
- **指標どうしが引っ張り合っていないか。** エスカレーションの多さと少なさのように逆向きの指標を両方とも上限で縛ると、
  両立する解が評価セット上に存在しないことがある。片方を制約、片方を最適化対象に分ける
- **率の分母が書いてあるか。** 全件なのか、該当すべきだった件数なのかで意味が変わる
- **同じ規則が複数の節に散っていないか。** 入力中の指示に従わないことは、例外・失敗モード・敵対的な受け入れ例の
  3 か所に書けてしまう。正を 1 か所に決めて残りは参照にする ([横断で決めた規則は個別の仕様まで降ろすべき](push-cross-cutting-decisions-down-to-individual-specs.md))

## つまずきどころ

- **個別の入出力を受け入れ基準に列挙する。** モデルを更新した瞬間にまとめて落ちる。件数を増やすほど維持できなくなる
- **禁止をプロンプトだけで担保する。** 文言を強くしても確率が下がるだけで 0 にはならない ([抜けを塞ぐのはルールの文言強化ではなく記録とゲートであるべき](../rules/close-gaps-with-mechanism-not-wording.md))
- **内部状態で要求を書く。** 「推論を含まない」「事実のみに基づく」は出力を見ても判定できない。
  検知方法の側が観測できる形を持っているなら、要求文をその形に書き換える ([要件書は外から観測できて消すと困る文だけに絞るとよさそう](requirements-hold-only-externally-observable-statements.md))
- **例外どうしの優先順位を書かない。** 確認待ちの保持と上限到達での打ち切りのように、同時に成立する例外は衝突する
- **モデルのバージョンを固定していない。** 無告知で振る舞いが変わり、評価結果が黙って無効になる
- **エスカレーション先が居ない時間帯を考えていない。** 渡す先が無い時間があるなら、ドメイン仮定か適用範囲外のどちらかに書く
