---
type: concept
nature: fact
title: CLAUDE.md と @import は system パラメータではなく最初の user メッセージに入る
description: >-
  Explains where CLAUDE.md actually lands in the Messages API request that Claude Code sends: not in
  the system parameter, but inside the first user message, wrapped in system-reminder tags, ahead of
  the text the user typed. The system parameter holds only Claude Code's own agent rules. Also covers
  how @import expands: the import is appended as a labelled block rather than substituted in place,
  so the literal @path string stays in the text and the file contents follow it under a "Contents of
  ..." header, and a path written without @ is just text. Use when reasoning about why CLAUDE.md
  instructions are not reliably followed, when deciding between CLAUDE.md, a subagent body, and
  --append-system-prompt, or when assuming @import saves context. Not a fix for adherence: position
  explains the weakness but changing it is not available for project instructions, and anything that
  must hold belongs in a hook.
tags: [claude-code, prompting, context-management]
keywords:
  - CLAUDE.md
  - "@import"
  - system prompt
  - system-reminder
  - messages[0]
  - user メッセージ
  - mitmproxy
  - Messages API
  - cache_control
  - --append-system-prompt
  - Contents of
  - project instructions
  - 遵守されない
  - 展開
  - 追記
status: stable
verified_at: 2026-09-06
stale_after: 2027-03-06
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/memory
  - https://dev.classmethod.jp/articles/claude-code-at-import-mitmproxy/
---

# CLAUDE.md と @import は system パラメータではなく最初の user メッセージに入る

## 要点

CLAUDE.md はシステムプロンプトではない。`<system-reminder>` で包まれて、最初の user メッセージの中に入る。
`system` パラメータに入っているのは Claude Code 自身の規則だけ。
だから「CLAUDE.md に書いたからシステムプロンプト級に効く」という前提は成り立たない。

## 仕組み

### リクエストの中の位置

| 場所 | 中身 |
|---|---|
| `system` | Claude Code 自身のエージェントとしての人格と行動規則。`cache_control` (ephemeral) が付く |
| `messages[0].content[0]` | `<system-reminder>` で包まれた CLAUDE.md と `@import` の展開結果 |
| `messages[0].content[1]` | ユーザーが実際に打ったプロンプト |

公式の memory ページも同じことを書いている。「CLAUDE.md の内容はシステムプロンプトの後に user メッセージとして届く。システムプロンプト自体の一部ではない」。
この記述は「Claude が CLAUDE.md に従わない」という節の中にあり、厳密な遵守が保証されない理由として挙げられている。

### @import は置換ではなく追記

`@path/to/file.md` と書いたとき、その文字列が中身に**置き換わるのではない**。

1. CLAUDE.md 本文の `@path/to/file.md` という文字列はそのまま残る
2. その後に `Contents of <パス> (project instructions, checked into the codebase):` というラベル付きのブロックが続き、ファイルの中身が入る

モデルから見ると、同じファイルへの参照が 2 回現れることになる。パス文字列と、ラベル付きの本文。
`@` を付けずにパスを書いた場合は何も読み込まれず、ただの文字列として残る。

### どう確かめられたか

出典の記事は mitmproxy を reverse mode で挟み、Claude Code から `https://api.anthropic.com/v1/messages` へ出るリクエストを覗いている。
目印の文字列をファイルに仕込み、JSON のどのキーに現れるかを追う方法。

このリポジトリでも符合は確認できた。VS Code 拡張の Claude Code 2.1 で、最初の user ターンの `<system-reminder>` の中に
`Contents of <絶対パス> (project instructions, checked into the codebase):` というラベルで CLAUDE.md と `.claude/rules/` の各ファイルが並ぶ。
記事と同じ構造。ただしこちらは自分の context に届いた形を見ただけで、wire の JSON は見ていない。

## 使いどころ

- **位置を理由に強さを見積もらない。** CLAUDE.md は user メッセージなので、会話が進むほど後ろに流れ、他のトークンと同じように薄まる
  ([注意が全トークンに配られる](../model/attention-dilutes-as-context-grows.md))
- **本物のシステムプロンプトに入れる手段は 2 つしかない。** サブエージェントの markdown 本文と `--append-system-prompt`。
  後者は毎回渡す必要があるので自動化向き。プロジェクトの指示を強い位置に置きたいなら、サブエージェントに切り出すこと自体が手段になる
- **`@import` は context を節約しない。** 展開されて全部載る上に、パス文字列も残る。分割は読みやすさのためであって、削減にはならない。
  減らしたいなら `paths:` 付きの rules にして[一致ファイルを読んだときだけ載せる](path-scoped-rules-load-on-read-not-on-write.md)

**効かない場面。** これは位置の説明であって、位置を直せば守られるという話ではない。
サブエージェント本文に移してもシステムプロンプトの中で薄まる。必ず守らせたい規約は[文言ではなく機構で塞ぐ](close-gaps-with-mechanism-not-wording.md)。

## 関連

- [CLAUDE.md は最小から始めモデルが外したときだけ足すのがよいはず (未検証)](claude-md-starts-minimal-and-grows-only-on-misses.md)。薄まる前提での書き方
- [rules の paths frontmatter は Write には効かず、一致ファイルを Read したときだけ読み込まれる](path-scoped-rules-load-on-read-not-on-write.md)。無条件に載る分を減らす手段とその限界
- [本当に守らせたい内容は指示側の誘導と出力側の検査を対で置かないといけない](../workflow/pair-steering-with-output-check.md)。位置を上げても足りないときの形
- [Claude Code の機能が分かれているのは context を守るため](../workflow/features-split-to-protect-the-context-window.md)。CLAUDE.md がどの消費源に当たるか
