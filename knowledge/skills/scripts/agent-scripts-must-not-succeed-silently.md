---
type: pattern
nature: principle
title: エージェントが呼ぶスクリプトは無言で成功しないものであるべき
description: >-
  A design rule for scripts that an AI agent invokes as part of a workflow: if the thing the caller asked to
  change cannot be found, write nothing back and exit non-zero; if a fallback returns an empty result, say
  that it is a fallback rather than reporting "none"; if items were skipped, print the count. The agent treats
  exit 0 as "done" and has no other way to notice that a header line was never updated, that "PR: none" came
  from a missing CLI, or that an index silently dropped a directory. Use when writing or reviewing helper
  scripts, hooks, or wrappers that agents call, especially ones that edit files or degrade on missing tools.
  Not for interactive tools where a human reads the output, and not a substitute for input validation.
tags: [workflow, tool-use]
keywords: [無言の失敗, 無言の成功, silent failure, 終了コード, exit 0, 書き戻さない, set-header, 一致件数, 沈黙する縮退, 誤情報, PR なし, skipped, 可視化, stderr, 警告, エージェント向けスクリプト]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: tool
---

# エージェントが呼ぶスクリプトは無言で成功してはならない

## 課題

人間なら出力を見て「何も変わっていない」と気づくが、エージェントは終了コード 0 を「できた」と読んで次へ進む。
元プロジェクトで実際に起きた 3 つの形。

| 形 | 何が起きたか |
|---|---|
| 書き換え対象が無いのに成功 | 引き継ぎファイルのヘッダ行が `- Draft PR:` という別表記だったため、`set-header --pr` はどの行にも一致せず、**1 バイトも変えずに終了コード 0** を返した。エージェントは更新できたと誤認した |
| 沈黙する縮退が誤情報になる | PR 取得関数が `gh` の失敗を握りつぶして空を返す実装だったため、CLI が無い環境で SessionStart hook が「PR: なし」と**誤った情報をコンテキストへ注入**していた。「PR が無い」と区別が付かない |
| 失敗が警告として正常扱い | 片付けスクリプトの中でインデックス再生成が**正常系で一度も成功しない**まま警告扱いになっていた。本当の異常が同じ警告に埋もれる |

1 つ目は表記のゆらぎが引き金であって原因ではない。原因は一致件数を持たず 0 件でも無条件に書き戻していたこと。表記を統一しても、
行を消した・別ファイルを指した場合に同じことが起きる。

## 解決

- **書き換え対象がちょうど 1 件見つからなければ、ファイルを書き戻さずに非 0 で終了する。** これを個別コマンドの話にせず、スクリプト全体の方針として仕様書に 1 本立てる。
  エラーメッセージには正しい表記と直し方を出し、1 回だけ手で直せば以降は雛形が維持する形にする
- **表記のゆらぎの発生源を断つ。** 雛形に行を持たせ、書き起こしを無くす。別名を受け付けるパターンの拡張は、次の別名が現れたときに同じ判断を繰り返すので採らない。
  ただし「失敗させる」とセットでないと既存ファイルで無言の失敗が続いて悪化する
- **見つからない行を自動挿入しない。** 誤記の行と正しい行が並び、どちらが現在の値か読めなくなる。「後から増える項目」として設計した行だけ例外
- **縮退したら縮退したと言う。** CLI が無いなら「CLI 不在」と言い、空を返して「無い」に見せない
  ([name-the-alternative-in-failure-message.md](../../mcp/name-the-alternative-in-failure-message.md))
- **スキップは正しい結果として扱いつつ件数を必ず出す。** `skipped <N> deleted file(s)` のように stderr とサマリへ載せる。無言でスキップすると
  「消えるはずのないファイルが消えた」異常を隠す
- **判定は引数の形ではなく書き換え後のファイルの状態で行う。** 「ループ範囲を網羅する引数か」ではなく「書き換えた結果、範囲の記号が揃っているか」を検査する。
  守りたいのはファイルの性質だから。拒否するときは 1 件も書き戻さず、指定し直すコマンド例を表に存在する行だけで組み立てて出す

## 適用条件

- 効く: エージェントが手順の一部として呼ぶスクリプト、hook、ラッパー。とくにファイルを書き換えるものと、道具の不在で縮退するもの
- 効かない: 人間が対話的に使う道具。`git add --` のように「対象が無ければ何もしない」が仕様として自然なものまで変えない

## トレードオフ

- 得る: エージェントが誤認したまま進まない
- 失う: 非互換。旧形式のファイルで必ず失敗するようになる。復旧手順を失敗メッセージに出す

## 関連

- [ルールの文言強化ではなく記録とゲートで抜けを塞ぐ](../../rules/close-gaps-with-mechanism-not-wording.md)
- [失敗メッセージに代替手段を名指しで埋め込む](../../mcp/name-the-alternative-in-failure-message.md)
- [hook を注入系とガード系に分け、失敗時の既定を逆にする](../../hooks/common/injecting-vs-guarding-hooks.md)。注入系は fail-open でよいが、注入する**内容**が誤情報になってはならない
