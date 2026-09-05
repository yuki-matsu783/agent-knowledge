---
type: pitfall
nature: fact
title: 生の文字列でコマンドを判定すると引用符とコメントに誤爆する
description: >-
  Explains why a PreToolUse guard that runs a regex over the raw tool_input.command both blocks
  harmless calls (a banned command quoted inside an echo or a trailing # comment) and misses real
  ones (p""ush, ls;git push), and how tokenizing with a shell lexer such as Python's shlex before
  matching fixes it. Use when writing or debugging a hook script that decides on Bash commands, or
  when the agent reports being blocked on a command it never ran. Not for matching file paths, which
  come from tool_input.file_path, and not a defense against $() substitution or shell variables,
  which no lexer resolves.
tags: [claude-code, security, workflow]
keywords: [shlex, トークン, 字句解析, 正規表現, 誤爆, 誤検知, すり抜け, PreToolUse, hook, tool_input.command, punctuation_chars, comments, posix, ValueError, fail-open, git push, sh -c, 引用符, コメント]
status: stable
verified_at: 2026-09-05
applies_to: [python@3.12, claude-code@2.1]
sources:
  - https://docs.python.org/3/library/shlex.html
  - https://code.claude.com/docs/en/hooks
---

# 生の文字列でコマンドを判定すると引用符とコメントに誤爆する

## 症状

PreToolUse のガードで `tool_input.command` に `\bgit\s+push\b` のような正規表現をかけると、両方向に外れる。

| 実際のコマンド | 生の正規表現 | 正しい判定 |
|---|---|---|
| `echo "do not run git push"` | 止める | 通す (実行されるのは echo) |
| `ls -la  # git push はしない` | 止める | 通す (コメント) |
| `git commit -m "rm -rf everything"` | 止める (`rm` 禁止時) | 通す (メッセージの中身) |
| `git p""ush` | 通す | 止める |
| `ls;git push` | 通す (`\bgit` の前が `;` なので実装次第) | 止める |

誤爆の方が厄介で、Claude には「なぜ止められたか」が本当に分からない。ログ調査のつもりで書いた `grep` が止まり、
言い換えを繰り返し、最後は別の道を探し始める。すり抜けの方は、ガードがあるという安心だけが残る。

## 原因

`tool_input.command` は shell が解釈する**前**の 1 本の文字列。引用符、コメント、エスケープ、`;` や `&&` の区切りは
shell の語彙であって、正規表現の `\b` はそれを知らない。「文字列としてどこかに含まれるか」と
「コマンドとして実行されるか」は別の問いで、前者で後者を近似しているのが誤りの正体。

## 回避策

shell と同じ語彙でトークンに割ってから、**実行される語だけ**を見る。Python なら `shlex` が標準ライブラリにある。

```python
import shlex

def tokenize(command: str) -> list[str]:
    lx = shlex.shlex(command, posix=True, punctuation_chars=True)
    lx.whitespace_split = True
    return list(lx)   # ValueError は呼び出し側で捕まえる
```

`shlex.split()` ではなく `shlex.shlex(..., punctuation_chars=True)` を使う。split は既定が `comments=False` で
`#` 以降が語として残り、区切り文字も分けない。実測 (python 3.12) の差は次の通り。

| 入力 | `shlex.split` | 上の `tokenize` |
|---|---|---|
| `ls -la  # git push` | `['ls','-la','#','git','push']` | `['ls','-la']` |
| `ls;git push` | `['ls;git','push']` | `['ls',';','git','push']` |
| `git p""ush` | `['git','push']` | `['git','push']` |
| `grep "#todo" .` | `['grep','#todo','.']` | `['grep','#todo','.']` |

引用符の中の `#` はコメントにならない。`p""ush` のような引用符での分断は、どちらでも `push` に戻る。

### トークンを得たあとにやること

- **区切りでセグメントに割る**。`;` `&&` `||` `|` `&` `(` `)` が独立したトークンで来るので、そこで切り、
  セグメントごとに先頭を見る。1 つ目が無害でも 2 つ目で消される
- **先頭を正規化する**。`GIT_DIR=/tmp` のような環境変数代入を捨て、`/usr/bin/git` は basename にする。
  `env` `sudo` `nohup` `time` `xargs` は次の語が本体
- **包みを開く**。`sh -c` `bash -c` `node -e` `python -c` の引数は、それ自体が 1 トークンのコマンド列
  (`sh -c "git push"` → `['sh','-c','git push']`)。中身を再帰的に tokenize しないと、1 段包むだけで抜ける
- **パース失敗は deny にする**。引用符が閉じていなければ `ValueError: No closing quotation` が飛ぶ。
  例外でスクリプトが落ちると hook は判定を返さず素通りする ([hook-timeout-fails-open.md](hook-timeout-fails-open.md))。必ず捕まえて「解釈できないコマンドは実行しない」と返す

### 限界

- `$(...)` とバッククォートの中身は展開されない。`echo $(git push)` は `['echo','$','(','git','push',')']` になる。
  括弧の中も判定するなら別セグメントとして自分で扱う
- 変数、alias、shell 関数は解決できない。`$G push` が何になるかは実行するまで分からない
- `posix=True` は `\` をエスケープとして食う。`cat C:\Users\me\a.txt` は `['cat','C:Usersmea.txt']` になる。
  Windows のパスを見たいなら `posix=False` ではなく、`tool_input.file_path` 側で判定する。`posix=False` にすると
  引用符が語に残り (`'"git push"'`)、引用符での分断も戻らなくなる
- POSIX shell の語彙が前提。PowerShell や cmd を叩く環境では合わない

Node に shlex 相当の標準ライブラリは無い。判定だけ `.venv/Scripts/python.exe` (Linux は `.venv/bin/python`) を直接呼ぶのが速い
(起動 0.5 秒、[scripting.md](../../.claude/rules/scripting.md))。`pnpm exec` や `uv run` を挟むと 1 回で 3 秒級になる。

## 関連

- [権限は permissions.deny ではなく PreToolUse hook で止める](deny-by-hook-not-permissions.md)。「判定の前に正規化する」の具体的なやり方がこれ。判定をスクリプトに寄せる意味はトークン化できることにある
- [生のコマンド実行を deny してラッパスクリプトへ誘導する](command-wrappers-instead-of-raw-bash.md)。あの `case` 文による文字列一致も同じ誤爆をする。対象が数語なら許容できるが、ルールが増えたらトークン化に移す
- [タイムアウトした hook はガードにならず素通りする](hook-timeout-fails-open.md)。トークン化は失敗しうる処理なので、例外とタイムアウトの両方で fail-open しないようにする
