---
type: pattern
nature: principle
title: 意味理解を要する判定はエージェントのもので、スクリプトには決定的な判定だけがあるべき
description: >-
  A boundary rule for agent workflows built on shell scripts: anything that needs understanding of meaning
  (translating a Japanese issue title into an English branch slug, picking search keywords for a duplicate
  check, deciding whether an issue should be split, judging which issues a change affects) belongs to the
  agent with written guidance, while scripts hold only what can be decided mechanically (search and merge
  results, detect duplicate ids, compute ranges). Bash cannot extract Japanese keywords (locale-dependent
  char handling fails silently), and a script that guesses meaning fails silently too. Use when tempted to add
  a translation API, a stopword list, or a numeric threshold to a helper script. Not for decisions that must
  be reproducible bit-for-bit, and not a reason to skip unit tests on the mechanical part.
tags: [tool-use, prompting, workflow]
keywords: [意味理解, 決定的判定, キーワード抽出, 形態素解析, ロケール依存, LC_COLLATE, 文字クラス, スラッグ, 意訳, 翻訳 API, ストップワード, 定量閾値, issue 分割, AND 検索, OR 統合, 再現率, 黙って外れる]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: tool
---

# 意味理解を要する判定はエージェントへ委ねスクリプトには決定的な判定だけを置く

## 課題

エージェントのワークフローを bash スクリプトで支えていると、「賢い判定」をスクリプト側に持たせたくなる場面が繰り返し出る。

- 日本語の issue タイトルから英語のブランチ slug を作りたい (非 ASCII を除くだけの実装では slug が空になる)
- 起票前の重複チェックで、issue 本文からキーワードを抽出して検索したい
- issue が大きすぎるとき分割を促したい
- マージ前に、この変更で前提が変わる他の issue を見つけたい

いずれもスクリプトで書くと**黙って外れる**。bash の 1 文字取り出し (`${text:i:1}`) も文字クラス (`[[ $c == [ぁ-ん] ]]`) もロケール依存で、
`LANG` が UTF-8 でない git bash ではバイト単位の動作になる。失敗してもエラーにならず、検索の再現率が静かに下がるだけで誰も気づけない。
定量閾値 (受け入れ条件の個数、本文の行数) で分割を判定すると、不可分な大 issue を割ろうとし、独立した小 issue を見逃す。

## 解決

| 判定 | エージェント (skill の手順として指針を書く) | スクリプト |
|---|---|---|
| ブランチ slug | issue タイトルの意味を汲んだ英語フレーズ (3〜6 語) を生成して渡す | 渡された文字列のサニタイズだけ。翻訳 API もローマ字変換も持たない |
| 重複チェック | そのissue 固有の語 (機能名・関数名) と汎用語 (「追加」「修正」) を文脈から選ぶ。選ぶ語／選ばない語の指針を明記して再現性を担保 | 与えられた語で検索し、結果を正規化・統合する。GitHub / GitLab の検索は複数語を AND 扱いするので**1 語ずつ検索して OR 統合**し、上限 (5 語) を超えた分は切り捨てを stderr へ通知 |
| issue 分割 | 「同型の成果物が並列に列挙されているか」を見て提案する。判定は「各項目が単独でマージされてもシステムが壊れないか」の一問に集約。決定は人間 | 無し。意味理解をスクリプトへ委ねると外したときに黙って促す／促さないことになり、誤りに気づく契機が失われる |
| 影響先 issue | 差分と相手の issue 本文を突き合わせて 3 類型 (前提が変わる／一部が解決される／記述が矛盾する) で判定し、人間の承認を得る | キーワード検索だけ |
| 決定記録の番号重複 | 無し | **決定的に判定できる**のでスクリプトで判定する ([detect-conflicts-with-merge-tree.md](../../workflow/detect-conflicts-with-merge-tree.md)) |

エージェントが適任なのは、直前に自分でタイトルや本文を組み立てていて文脈を持っているから。同じ処理を bash 層へ持たせるとネットワーク依存や
API キー管理、変換辞書という新しい前提が増える。

slug がエージェント生成になると実行のたびに文言が変わる (非決定的) ので、「既にブランチがあるか」の判定は slug を含む完全一致ではなく
issue 番号の prefix パターン一致にする。非決定性は、それに依存する下流の判定を書き換えて吸収する。

## 適用条件

- 効く: 判定に自然言語の理解が要り、外れたときに人間が候補を見て直せる設計にできる場面
- 効かない: 結果の再現性が要る判定。スクリプト側の純粋ロジック (正規化・統合・重複判定) にはこれまでどおり単体テストを付ける。
  「キーワード抽出の単体テスト」は存在しなくなるので、その理由を決定記録に残す

## トレードオフ

- 得る: 静かに壊れる処理を持たない。スクリプトは git / jq / gh / glab だけの自己完結を保てる
- 失う: 同じ入力でも候補の並びが変わりうる。重複チェックのように「候補を人間に提示する」用途なら許容できる

## 関連

- [エージェントに任せる操作と人間承認が要る操作の線引きは可逆性で決める](../../workflow/reversibility-decides-who-acts.md)
- [エージェントが呼ぶスクリプトは無言で成功してはならない](agent-scripts-must-not-succeed-silently.md)。切り捨てを通知するのも同じ原則
- [merge-tree で作業ツリーを汚さずにベースブランチとの衝突を検知する](../../workflow/detect-conflicts-with-merge-tree.md)
