---
type: pattern
nature: best-practice
title: コピーした定型行はバイト一致をテストで固定すべき
description: >-
  A pattern for boilerplate that a convention says to "copy verbatim and change only the arguments"
  (a library load line that resolves the repository root, so it cannot itself be sourced): collect every
  copy with grep, compare the line byte-for-byte with the template, fail listing the files that differ, and
  when the template changes put "replace all N copies" on the plan as its own work item. Without the check
  the copies drift on the first change (a new variable added to the template reached none of 20+ copies),
  leaving production paths on the old contract while tests on the template pass. Use when a repository has
  more than a handful of identical lines by rule. Not for code that can simply be extracted into a shared file.
tags: [workflow, evaluation]
keywords: [定型行, 逐語コピー, ドリフト, バイト一致, テンプレート, 雛形, grep, 一斉置換, 読み込み行, __ss_load, 鶏と卵, 見積もり, 作業項目, 20 本]
status: stable
sources: []
intervention: tool
---

# コピーした定型行はバイト一致をテストで固定する

## 課題

hook と提供コマンドの全スクリプトが先頭に持つ「読み込み行」(リポジトリルートを解決してライブラリを `source` する関数) は、
規約で「雛形からコピーして引数だけ変え、中身を自作・改変しない」と定めていた。実体は雛形 2 本を含めて **20 本以上**にコピーされている。

読み込み行の仕様に変数を 1 つ足したとき (読めなかった事実を `FM_AVAILABLE=0` に置く) に、3 つが分かった。

1. 全コピーが旧仕様のままで、新しい変数をどこにも設定していない
2. 申し送りは「雛形の読み込み行も合わせる」としか書いておらず、既存のコピーへの波及に触れていない
3. 唯一の関連テストは**雛形だけ**を読んでおり、各コピーが雛形と一致することを検査するテストが存在しない

雛形だけ直して通ったテストの裏で、本番経路 (許可範囲の判定ライブラリ) が旧仕様のまま残る。

## 解決

- **バイト一致のテストを 1 本置く。** リポジトリ内の対象ファイル (`grep -rl '^__ss_load() {'` で集める) の当該行が、雛形のそれと文字列として一致すること。1 か所でも違えば失敗し、**違うファイルを列挙する**。
  「どこかが違う」だけでは直せない。既存の assert ヘルパで書け、数秒で終わる
- **一斉置換を計画の作業項目に立てる。** 「20 本以上を手で直す」が見積もりから漏れると必ず後回しになる。雛形を先に直してテストを通し、それから他のファイルを合わせる
- **「コピーせよ」規約には一致検査が対になる**、と規約の側に書く。検査しない限り必ずドリフトする。今回が 1 回目で、次に読み込み行を変えるときも同じことが起きる

## 適用条件

- 効く: 構造上 1 ファイルに切り出せない定型。読み込み行は「リポジトリルートを解決するための行」なので、それ自体を `source` するにはルートが要り、鶏と卵になる
- 効かない: 切り出せるコード。切り出せるなら切り出す。ビルド段階で雛形から生成する案も、この機構には `.sh` を直接実行する構成しか無く、生成物と原本の乖離を別の手段で検査することになり問題が 1 段深くなる
- 「機能が同じ」を検査する案 (各コピーを実行して振る舞いを比べる) は 20 本分のテストが要る。文字列一致で十分

## トレードオフ

- 得る: 雛形を変えたらテストが落ちる、という関係が素直に成立する。本番経路と雛形の乖離が構造的に無くなる
- 失う: 雛形の変更が常に「全コピーの置換」を伴う。行を変える頻度は低いので許容できる

## 関連

- [source するライブラリは読み込み失敗を呼び手に委ね戻り値で 3 状態を返す](bash-return-code-conventions-for-sourced-libs.md)。読み込み行が持つ規約の中身
- [横断で決めた規則は個別の仕様まで降ろす](../workflow/push-cross-cutting-decisions-down-to-individual-specs.md)。「雛形だけ直して波及を見ない」の文書版
- [ルールの文言強化ではなく記録とゲートで抜けを塞ぐ](../rules/close-gaps-with-mechanism-not-wording.md)。「コピーせよ」の文言だけでは守られない
