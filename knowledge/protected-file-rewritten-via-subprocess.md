---
type: pitfall
title: Edit/Write を deny してもスクリプト経由でファイルは書き換わる
description: >-
  Explains why denying the Edit and Write tools does not actually protect a file in Claude Code:
  path rules written for Write, NotebookEdit or MultiEdit are accepted but never consulted, deny
  rules do not reach files that a Node or Python subprocess opens itself, and a PreToolUse hook
  with a Write|Edit matcher never fires on Bash. Use when a file you meant to freeze keeps changing,
  when hardening generated artifacts or config, or when deciding between permission rules, the
  sandbox, and detection hooks. Not for blocking file reads or secret exfiltration, and not for
  choosing what to deny in the first place.
tags: [claude-code, security, observability]
keywords: [permissions.deny, Edit, Write, NotebookEdit, MultiEdit, PostToolUse, Stop hook, matcher, リダイレクト, サブプロセス, sandbox, filesystem.denyWrite, 保護, 書き換え, 生成物, git status, サブエージェント, 監視]
status: stable
verified_at: 2026-09-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/permissions
  - https://code.claude.com/docs/en/sandboxing
  - https://code.claude.com/docs/en/hooks
  - .claude/hooks/protect-generated.sh
---

# Edit/Write を deny してもスクリプト経由でファイルは書き換わる

## 症状

保護したはずのファイルが、セッションの終わりに見ると変わっている。permissions にも hook にも書いたのに止まっていない。抜ける経路は 3 つある。

- **`Write(path)` は誰も見ていない**。ファイルパスの検査に使われるのは `Edit(path)` と `Read(path)` だけ。`Write` `NotebookEdit` `MultiEdit` にパスを付けたルールは受理されるが一度も参照されず、起動時に warning が出て終わる。`Edit(docs/**)` と書く
- **スクリプトが開いたファイルは素通りする**。`Read` と `Edit` の deny が効くのは組み込みのファイルツールと、Claude Code が認識する Bash のファイルコマンド (`cat` `head` `tail` `sed`) まで。`node fix.js` や `python -c` が自分で open して書くぶんには何も起きない
- **hook の matcher を `Write|Edit` に絞ると Bash が抜ける**。このリポジトリの [protect-generated.sh](../.claude/hooks/protect-generated.sh) がその形で、`.tool_input.file_path` しか見ていない。同じパスへ Bash から書けば hook 自体が起動しない (matcher `Write|Edit` の PreToolUse を入れた状態で、Bash の `echo x > .../INDEX.md` が素通りすることを確認した)

一方で**リダイレクトは穴ではない**。`>` `>>` `2>` の書き込み先は Edit ルール・protected paths・working directories と照合される。検査されないのは `/dev/null` と、`~` 始まりや glob を含む書き込み先 (これは承認が要る) だけ。

## 原因

止める仕組みが 2 つあり、見ている層が違う。permission system は**ツール呼び出しの引数**を見る。sandbox は**プロセスのシステムコール**を見る。片方だけではファイル書き換えの経路を覆えない。

| 書き換えの経路 | permissions の `Edit(path)` | sandbox の `filesystem.denyWrite` |
|---|---|---|
| Edit / Write ツール | 効く | 効かない (組み込みファイルツールは sandbox を通らない) |
| Bash の `cat` `sed` など認識されたコマンド | 効く | 効く |
| Bash のリダイレクト先 | 効く | 効く |
| スクリプトが内部で open するファイル | **効かない** | 効く |

さらに sandbox は macOS / Linux / WSL2 だけで native Windows では動かない。Windows を想定環境に含むなら、OS レベルの層は最初から無いものとして設計する。

## 回避策

止める層で完結させず、**検知して戻す層**を足す。

### 1. パスルールは Edit に寄せる

```json
{ "permissions": { "deny": ["Edit(INDEX.md)", "Edit(./**/index.jsonl)"] } }
```

`Read` の deny は同じパスの Edit と Write も止める (新規作成も含む) が、NotebookEdit は覆わない。どのツールにも変えさせたくないパスには `Edit` の deny を必ず書く。

### 2. 止める hook は matcher を絞らない

`matcher` を空にして全ツールに走らせ、Bash なら `command`、ファイルツールなら `file_path` を見る。ツールの振り分けを hook 側に持つ理由は [権限は permissions.deny ではなく PreToolUse hook で止める](deny-by-hook-not-permissions.md) にまとめてある。

### 3. PostToolUse は tool_input ではなく実物を見る

引数を解析して書き換えを予測すると、スクリプト経由がそのまま抜ける。走ったあとの状態を見る。git があるなら差分が一番速い。

```sh
#!/bin/sh
# PostToolUse (matcher ""): 保護対象が変わっていたら Claude に知らせる
changed=$(git status --porcelain -- .claude/settings.json .claude/hooks)
[ -z "$changed" ] && exit 0
printf '保護対象が変更されている。意図した変更でなければ git checkout -- で戻す:\n%s\n' "$changed" >&2
exit 2
```

PostToolUse は止められない。`permissionDecision` を持たず、exit 2 は stderr を Claude に見せるだけ。返せるのは `additionalContext` と `systemMessage`。**成功したツール呼び出しの後にしか走らない**ので、失敗したコマンドが残した副作用は拾えない。

### 4. 取りこぼしの最後に Stop hook を置く

Stop と SubagentStop は exit 2 で停止をブロックし、Claude に応答を続けさせる。3 と同じ git 判定を置けば「直すまで終われない」になる。ツールごとに走る PostToolUse と違い、ターンに 1 回なので重い検査も置ける。

### 5. サブエージェントは判断が要るときだけ

定常監視をサブエージェントに任せる形は「この変更は設計を壊しているか」のような正規表現で書けない検査に向く。ただしサブエージェントも同じ permission system の中で動き、呼ばれた瞬間しか見ていない。決定的なガードにはならないので、hook と git の判定を土台にしてその上に載せる。

## 再現条件

claude-code@2.1、Windows (Git Bash)。matcher `Write|Edit` の PreToolUse hook を入れた状態で、Bash からの書き込みが hook を起動しないことを 2026-09-05 に確認した。permissions と hook の各挙動は公式ドキュメントの記載による。sandbox は native Windows で動かないため未検証。

## 関連

- [権限は permissions.deny ではなく PreToolUse hook で止める](deny-by-hook-not-permissions.md)。止める側の設計。この pitfall はそこで挙げた「間接的なファイルアクセスは見えない」を掘ったもの
- [タイムアウトした hook はガードにならず素通りする](hook-timeout-fails-open.md)。検知 hook も timeout すれば黙って素通りする。git の判定はローカルで完結させ、外部通信を混ぜない
- [ガードの設定と hook スクリプト自身をエージェントから守る](protect-guard-config-from-the-agent.md)。ここで足す検知 hook 自体も同じ理由で書き換えられる
