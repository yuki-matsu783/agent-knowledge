---
type: pitfall
nature: fact
title: rules の paths frontmatter は Write には効かず、一致ファイルを Read したときだけ読み込まれる
description: >-
  The `paths:` frontmatter of a Claude Code `.claude/rules/*.md` file does not apply to the Write tool:
  a rule scoped to a directory is not loaded when Claude creates a new file there, only when it reads a
  matching file. The official memory page says path-scoped rules trigger on reads, and an InstructionsLoaded
  hook log confirms `path_glob_match` right after Read but nothing after Write or Grep (Edit is always
  preceded by Read, so it is covered). Use when a skill creates new files under a path a rule is scoped to,
  when a rule seems ignored, or when deciding whether a rule may carry `paths` at all. Not for CLAUDE.md
  loading order, nested CLAUDE.md files, or the hook itself beyond its use as a probe.
tags: [claude-code, prompting, context-management]
keywords: [paths, rules, path-scoped rules, Write には効かない, 新規作成, path_glob_match, InstructionsLoaded, load_reason, session_start, Write, Read, Grep, Edit, 新規ファイル, 読み込まれない, 発火条件, 遅延ロード, knowledge-add, /context, Memory files]
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/hooks
  - https://zenn.dev/acntechjp/articles/5409d8e2ad0767
---

# rules の paths frontmatter は Write には効かず、一致ファイルを Read したときだけ読み込まれる

## 症状

`paths: ["knowledge/**/*.md"]` を付けた rule (本文の書き方の規約) があるのに、エージェントが knowledge/ に新しいファイルを Write して規約を外す。
既存ファイルを直すときは守れているので、rule が壊れているようには見えない。**Write の対象パスが paths に一致しても、その rule は読み込まれない。**

Claude Code 2.1 の `claude -p` で fresh session を起こし、`paths: ["wip/local/probe/**"]` の rule (読めたら合図の語を返せと書いた) を置いて、
ツールごとに InstructionsLoaded hook の `load_reason` と返答を記録した結果。

| セッションでやらせたこと | `path_glob_match` の記録 | 返答に合図の語 |
|---|---|---|
| Write で一致パスに新規ファイルを作る | 無し (Write の前にも後にも出ない) | 無し |
| Read で一致ファイルを読む | Read の PreToolUse の 1 秒後に rule が載る | 有り |
| Edit で一致ファイルを直す | モデルが先に Read するので Read の時点で載る | 有り |
| Grep (output_mode content) で一致ファイルの中身を見る | 無し | 無し |
| Bash のリダイレクトで一致パスに書く | 未測定 (`-p` では書き込み自体が止められた) | |

どのセッションも起動時に CLAUDE.md と paths 無しの rules を `session_start` で読んでいる。paths 付きの rule だけが後回しになる。

## 原因

公式の memory ページに明記されている。「Path-scoped rules trigger when Claude reads files matching the pattern, not on every tool use.」
読み込みの契機は InstructionsLoaded hook の `load_reason` が示す 5 つ (`session_start` / `nested_traversal` / `path_glob_match` / `include` / `compact`) で、
`path_glob_match` は Read ツールに紐づく。Write は「これから作るファイル」なので一致の対象にならず、Grep はファイルを「読んだ」扱いにならない。
Edit は Claude Code が事前の Read を要求するので、結果として Read 経由で載る。

## 回避策

- **新規ファイルを作る skill は、規約を明示的に読ませる。** 「templates/<type>.md をコピーする」のように同じ paths に一致する既存ファイルを Read させれば載るが、
  paths の集合が違う rule (knowledge/ だけに一致し templates/ に一致しないもの) は載らない。確実なのは skill の手順に「先に `.claude/rules/<name>.md` を Read する」と書くこと
- **短くて必ず要る規約は paths を外す。** 常時読み込みになる代わりに Write でも効く。長さと引き換え
- **載っているか確かめるのは InstructionsLoaded hook。** `load_reason` と `file_path` を jsonl に落とせば、どのツールの直後に載ったかが分かる。`/context` の Memory files でも現在の一覧は見える
- セッション開始後に作った rule は同じセッションでは拾われなかった (VS Code 拡張で 1 回の観察。一致ファイルを Read しても `path_glob_match` が出ない)。rule を足したら新しいセッションで確かめる

## 再現条件

- Claude Code 2.1 (CLI 2.1.235、`claude -p`、Windows の Git Bash)。モデルは haiku 4.5。hook は settings.local.json に InstructionsLoaded と PreToolUse を登録し、stdin を `jq -c` で 1 行にして追記
- 「セッション開始後の rule は拾われない」だけは VS Code 拡張のセッションで観察。他は CLI の fresh session
- 複数の hook が同じファイルへ同時に追記すると行が壊れる (63 行中 17 行)。ログの形式は
  [同時に書く hook の追記は tmpfile と mkdir ロックで直列化する](../hooks/scripts/concurrent-hook-writes-append-tmpfile-mkdir-lock.md) に従うこと

## 関連

- [context に入るものと入るタイミング](../diagrams/what-enters-context-when.dataflow.html)。常時・Read 時・Skill 呼び出し・hook の 4 経路を並べた archify のデータフロー図 (ブラウザで開く)
- [エージェントへの介入はガード・誘導・自動化の 3 機構で切るべき](../hooks/common/guard-steer-automate-mechanisms.md)。paths 付き rules は「呼ばれたとき」に届く誘導で、その「呼ばれたとき」が Read に限られる
- [rules を固定フォーマットの唯一の正にし、レビューは関心事ごとのサブエージェントが横断的に読むとよいはず](rules-as-single-source-for-authoring-and-review.md)。paths でルールを集める設計は、作成時に Read を経ない経路 (新規 Write) を別に埋める必要がある
- [抜けを塞ぐのはルールの文言強化ではなく記録とゲートであるべき](close-gaps-with-mechanism-not-wording.md)。規約が載っていない状態で書いたものは lint (PostToolUse) で拾う。このリポジトリの lint-on-edit.sh がその層
- [CLAUDE.md と @import は system パラメータではなく最初の user メッセージに入る](claude-md-arrives-as-user-message-not-system-prompt.md)。無条件に載る側が実際どこに届いているか
