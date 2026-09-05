---
type: pitfall
nature: fact
title: transcript の user 行の message.content は配列とは限らない
description: >-
  Warns that in the Claude Code transcript JSONL a `user` line's `message.content` is a plain string when the
  human typed a simple text message, and an array of content blocks only for tool results and structured
  input, so a jq filter that iterates `.message.content[]` throws on real data while passing every synthetic
  fixture. Use when a transcript parser fails on the first genuine user message, or when writing test fixtures
  for anything that reads transcript_path. Not for assistant lines, whose content is consistently a block
  array, and not a description of the Messages API request schema.
tags: [claude-code, observability, evaluation]
keywords: [message.content, 配列, 文字列, content block, jq, Cannot iterate over string, transcript, フィクスチャ, 実データ, 型ゆらぎ, user メッセージ]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# transcript の user 行の message.content は配列とは限らない

## 症状

transcript を jq で集計する処理が、実データで例外を出して止まる。合成フィクスチャによる単体テストはすべて通っている。

```
jq: error (at <stdin>:N): Cannot iterate over string ("...")
```

## 原因

`user` 行の `message.content` は、ツール結果などでは content block の配列だが、**人間が直接入力したシンプルなテキストでは
単一の文字列のまま**格納される。`.message.content[]` で無条件にイテレートすると文字列で落ちる。

発見のきっかけは、利用者の「レポートが出なくなっている」という報告メッセージそのものがこの形で記録されていたことだった。

## 回避策

配列のときだけ中身を返すヘルパーを通す。

```jq
def content_blocks: if (.message.content | type) == "array" then .message.content[] else empty end;
```

文字列も対象にしたいなら `type == "string"` の分岐で text block 相当に包む。

**教訓**: 方式の正しさと、実装が実データのサイズ・型のゆらぎに耐えるかは別の検証軸。合成フィクスチャは分岐の正しさは見るが、
実データでしか顕在化しない性質は拾えない。transcript 処理を変えたら、手元の本セッション自身の transcript に対して直接関数を呼んで確かめる。

## 再現条件

元リポジトリの実 transcript。同じ調査で「新規行 32 件 (約 120KB) を `--argjson` でコマンドライン引数として jq に渡し、Windows の引数長上限で
`Argument list too long` (終了コード 126) になって処理全体が無言で止まる」バグも見つかっている。transcript には tool_use / tool_result の生の
入出力がそのまま入るので、中身をシェル変数や引数で運ばず、ファイルパスを渡して jq の `inputs` で読ませる。

## 関連

- [Claude Code の transcript JSONL は /compact を挟んでも追記専用である](transcript-jsonl-is-append-only-across-compact.md)
- [resume すると transcript の行が別ブランチ名で再書き出しされる](transcript-lines-duplicated-on-resume.md)
