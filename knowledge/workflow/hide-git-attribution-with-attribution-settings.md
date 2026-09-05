---
type: reference
nature: fact
title: Claude Code のコミットと PR の帰属表記は attribution.commit と attribution.pr を空文字にすると消える
description: >-
  Reference for the Claude Code settings.json keys that control the attribution Claude adds to git
  commits (the Co-Authored-By trailer) and pull request descriptions: attribution.commit, attribution.pr,
  attribution.sessionUrl, the deprecated includeCoAuthoredBy, and includeGitInstructions. Use when a
  repository forbids AI attribution footers, when the trailer keeps appearing despite CLAUDE.md saying
  not to add it, or when deciding which key to set and where. Not for the commit workflow itself
  (how to split commits or write messages) and not for git hooks that rewrite messages after the fact.
tags: [claude-code, workflow]
keywords: [attribution, attribution.commit, attribution.pr, attribution.sessionUrl, includeCoAuthoredBy, includeGitInstructions, Co-Authored-By, Generated with Claude Code, Claude-Session, trailer, フッター, 帰属表記, コミットメッセージ, PR 説明, settings.json, CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS, system-reminder, do not add attribution lines]
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/settings-reference#attribution
  - https://code.claude.com/docs/en/settings-reference#includegitinstructions
---

# Claude Code のコミットと PR の帰属表記は attribution.commit と attribution.pr を空文字にすると消える

## 対象

Claude Code 2.1 (VS Code 拡張、2.1.235 で確認) の settings.json にある「Git and attribution」の設定。
公式 settings-reference の同名の節を一覧にし、VS Code 拡張で確かめた効き方を補足に書く。
どのスコープの settings ファイル (user / project / local / managed) にも書ける。

## 一覧

| キー | 型 / 既定 | 意味 |
|---|---|---|
| `attribution.commit` | string / 未設定 | コミットメッセージ末尾に足す文言 (trailer を含む)。未設定なら `Co-Authored-By: <モデル名> <noreply@anthropic.com>`。空文字 `""` で消える |
| `attribution.pr` | string / 未設定 | PR 説明に足す文言。未設定なら `🤖 Generated with [Claude Code](https://claude.com/claude-code)`。空文字で消える |
| `attribution.sessionUrl` | boolean / `true` | Claude Code on the web と Remote Control のセッションから commit / PR するとき、`Claude-Session` trailer と PR 内の claude.ai セッションリンクを付けるか。`false` で消える |
| `includeCoAuthoredBy` | boolean / `true` | 2.0.62 で非推奨。`false` で commit と PR の両方の表記を消す。`attribution.commit` か `attribution.pr` を 1 つでも設定するとこのキーは無視され、設定しなかった側は既定の文言に戻る |
| `includeGitInstructions` | boolean / `true` | 帰属表記ではなく git 指示そのものの ON/OFF。`false` にすると Bash ツール説明の commit / PR 手順と、system prompt の git status スナップショット (ブランチ、`git status`、直近コミット) を丸ごと外す。環境変数 `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` が 1 セッションだけ優先する |

`Co-Authored-By` の名前はセッションのモデル名 (例 `Claude Sonnet 5`) になる。Claude のモデルだが版を特定できないときは `Claude`、
`ANTHROPIC_BASE_URL` 経由の第三者モデルなど Claude と判定できないときは `Claude Code` になる。

全部消す設定は次の通り。公式の例はこのネスト形で書いてある。

```json
{
  "attribution": {
    "commit": "",
    "pr": "",
    "sessionUrl": false
  }
}
```

## 補足

### flat 表記でも効く

公式の一覧は `attribution.commit` のようにドット区切りでキーを並べているが、JSON の例はすべてネスト形。
このリポジトリの .claude/settings.json は次の flat 表記で書いていて、VS Code 拡張 2.1.235 で効いた
(user / local に attribution 系のキーは無く、managed settings も無い状態で確認)。

```json
{
  "attribution.commit": "",
  "attribution.pr": ""
}
```

どちらでも動くが、公式の例に合わせるならネスト形。

### 効き方は「モデルへの指示」で、git 側で剥がすのではない

この設定は commit-msg hook のように trailer を機械的に削るものではなく、Claude に渡す指示の文面を変える。
VS Code 拡張では system-reminder としてモデルに届き、文面は次のように変わる。

- 未設定: `End git commit messages with: Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` と、PR 説明の末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` を付けろという指示
- 空文字: `do not add attribution lines to git commit messages or pull request descriptions (this replaces any earlier attribution guidance)`

CLAUDE.md や commit skill に「フッターを付けない」と書いてあっても、この設定が未設定だと Claude は
「付けろ」と「付けるな」の両方を受け取る。矛盾を無くすには設定側も空文字にしておく。

### 設定を変えた直後のセッションでは古い指示が先に届いた

settings.json を保存した 46 秒後に始めたセッションで、最初の system-reminder は未設定時の文面
(`Co-Authored-By: Claude Fable 5.1` を付けろ) のままで、数ターン後に空文字時の文面に置き換わった。
settings の再読込のタイミングによるものと思われるが、原因は確かめていない。
設定を変えた直後は、モデルが古い指示に従って trailer を付けることがありうる。
確実に止めたいなら、設定だけに頼らず commit skill や commit-msg hook で守る。

system-reminder の本文はセッションの transcript jsonl に記録されない (自分のコマンド文字列以外ヒットしなかった)。
どの文面が届いたかを後から確かめる手段は無いので、変えた直後は最初のコミットの結果を見る。

## 関連

- [共同開発のエージェント設定は auto memory ではなく clone で揃う場所に置くべき](../rules/share-agent-config-via-repo-not-auto-memory.md): この設定もリポジトリの .claude/settings.json に置くと全員に効く
- [コマンドが約束する保証はコミット済みの版を自分で読んで担保するものであるべき](enforce-guarantee-by-reading-committed-version.md): 設定だけでは保証にならないときの守り方
