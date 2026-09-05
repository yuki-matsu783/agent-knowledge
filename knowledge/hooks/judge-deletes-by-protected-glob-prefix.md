---
type: pattern
nature: best-practice
title: 削除は配下を列挙せず保護 glob が対象で始まるかで判定すべき
description: >-
  An ordered seven-step rule for letting a PreToolUse guard allow some `rm` / `git rm` commands without
  weakening a default-deny stance: refuse when the target cannot be read, when it still contains unexpanded
  shell characters, when any protected/confirm/state glob begins with "<target>/" (the target is a directory
  that may hold guarded files, even ones not created yet), or when it is a state file; allow temp and log
  areas; allow only targets both classified as writable and explicitly declared for the ticket; refuse the
  rest. Motivated by Edit/Write having no delete, so a blanket deny left the agent unable to finish moves.
  Use when adding deletion to a path guard. Not for create/update judgments, which stay as they were.
tags: [claude-code, security]
keywords: [削除, rm, git rm, PreToolUse, 許可範囲, 保護 glob, 前方一致, "<対象>/", 展開前の文字, ブレース展開, ディレクトリ, 進行状態, 宣言, allow.write, 既定拒否, 移設, Edit/Write に削除は無い]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
intervention: hook
---

# 削除は保護 glob が対象で始まるかで判定し配下を列挙しない

## 課題

許可範囲を守る guard が、コマンドによる書き込み (リダイレクト・`cp` / `mv` / `rm`) を一律に拒否していた。Edit / Write にはファイルを消す手段が無いので、この状態では**エージェントがファイルを 1 つも削除できない**。
アセットを移設・整理するチケットは、新しい場所に置くことはできても古い場所から消せず、移設が完了しない。

一方で削除を無条件に通すと拒否側の担保が一気に緩む。`rm -rf .claude` の 1 行で機構そのものが消え、`rm logs/state.json` で進行状態が消え、`rm -rf .claude/hooks/*` のようにシェルが展開する前の文字列は宣言と照合しても意味を持たない。

## 解決

削除だけを行う段 (実行体が `rm`、または `git` でサブコマンドが `rm`) を、対象ごとに**次を上から順に当てて**判定する。

1. 対象を読み取れない (対象なし、クォートで潰れた語、`--pathspec-from-file`) → 拒否
2. 対象に展開前の文字 (`*` `?` `[` `{` `$` バッククォート `~` `,`) を含む → 拒否。照合が成立しない。`.claude/hooks/*` は宣言の `.claude/hooks/**` に文字列として一致するが、実際に消えるのはシェルが展開した後の実体
3. 保護・毎回確認・進行状態・種類ごとの拒否と確認のいずれかの glob が **`<対象>/` で始まる** → 拒否。対象がディレクトリで、配下に消してはいけない範囲を含み得る
4. 対象が進行状態のファイルに一致する → 拒否。一時置き場 (`logs/`) を通す設計だと、その中の記録ファイルが通ってしまう
5. 対象が一時置き場 (`wip/tmp/**` / `logs/**`) → 許可
6. 操作の分類が allow を返し、**かつチケットの宣言に明示されている** → 許可。共通の許可範囲だけで通すと、他のタスクの成果物や未着手のチケットを宣言もせずに消せる
7. それ以外 → 拒否

リダイレクト先は削除とは別に、従来どおり書き込みとして判定する。作成・更新 (`echo x > file`、`cp`、`mv`) の判定は変えない。移設は「新しい場所に Write → 旧ファイルを `rm`」の 2 手で行う。

3 の向きが要点。配下のファイルを全部たどって照合するのではなく、**守るべき範囲の glob の側から「対象/」で始まるか**を見る。実在しないファイルや実行時に増えるファイルにも先回りでき、
シンボリックリンクで判定がぶれない。守るべき範囲を含まないディレクトリは通る (`git rm -r --cached .claude/hooks/old/` は許可される)。

## 適用条件

- 効く: 既定拒否の path guard に削除を足すとき。削除は「何を消すか」だけで危険度が測れるので、作成・更新より判定が簡単で、対象の条件を厳しくすることで安全側に寄せられる
- 効かない: 作成・更新。中身の妥当性まで見ないと危険度が測れない
- `-r` / `-R` や末尾の `/` でディレクトリを判定しない。フラグ無しでも実体がディレクトリのことがあり、逆に `-r` 付きでもファイルだけを指すことがある。フックが実体を見に行かずに済む判定にする
- 展開後の文字列を機構が自分で展開して判定しない。実行時のカレントディレクトリと `shopt` に依存する展開を再現すると、実際に消えるものとずれる

## トレードオフ

- 得る: 移設・整理・一時ファイルの片付けがエージェントだけで完了する。提供コマンドに削除サブコマンドを足す案 (対象が多岐で 1 コマンドの引数に収まらない) より使い方が単純
- 失う: 削除を伴うステップは消す対象を宣言に含める手間。計画側の規約に「削除を伴うステップは消す対象を宣言に含める」を足す

## 関連

- [dir/** の glob はディレクトリ自身と祖先に一致しないので rm -rf dir が守りをすり抜ける](glob-double-star-does-not-match-parent.md)。3 の判定を「glob の側から」にした理由
- [エージェントが書く宣言で権限を広げられない](agent-written-declarations-cannot-widen-permissions.md)。6 で宣言を要求する枠組み
- [Edit/Write を deny してもスクリプト経由でファイルは書き換わる](protected-file-rewritten-via-subprocess.md)
