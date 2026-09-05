---
type: pattern
nature: best-practice
title: hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒すべき
description: >-
  A pure-bash design for a PreToolUse guard that decides whether tool_input.command really runs a banned
  subcommand (git commit, git push): normalize the string, scan only tokens in command position (skipping
  heredoc bodies, quotes, comments, prose), then fall back to the old substring match, which blocks, whenever
  the input cannot be read statically: eval/xargs/find -exec/bash -c, lines over 8 KB, or a bash too old to
  load the library. Use when a substring guard misfires on Japanese prose that mentions the command, or when
  choosing the failure direction for an unparseable command. Not a full shell parser or an adversarial
  boundary (quoted splitting, aliases, and variables are out of scope), and not for Python environments,
  where a shlex-based tokenizer is simpler.
tags: [claude-code, security, workflow]
keywords: [PreToolUse, tool_input.command, コマンド位置, 正規化, 部分一致, 縮退, fail-closed, ブロック側, eval, xargs, bash -c, ヒアドキュメント本文は実行位置でない, 誤検知, 素通り, 純粋 bash, fork 0 回, 8192 バイト, 回帰観点, クォートで割れた語, 特定できない]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: hook
---

# hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒す

## 課題

`git commit` の直接実行を止める PreToolUse hook が `grep -qiE` による「git + 空白 + commit」の部分一致だけで発火を決めていると、
ヒアドキュメント本文・クォート内・コメント・日本語の地の文で誤検知する。「この仕組み自体を説明する文章」を書くたびに止まり、
「`git` と `commit` を連続させない」というルールで回避していたが、**エージェントが毎回思い出す必要のあるルールは守られない**
(そのルールを書く作業中に自分で 2 回踏んだ)。

一方、クォートやヒアドキュメントを除外するだけの案は、`bash -c "… commit"` `eval` `echo "$(… commit)"` `xargs … commit` `find -exec … commit` の
5 類型で**新しい素通りを作る**。除外と同時に塞ぐ必要があった。

## 解決

判定を 3 段にする。

1. **正規化**: バックスラッシュエスケープ (`\git` のような alias 迂回書式) を解決し、大文字小文字を揃える。ダブルクォート内の `$( )` と
   バッククォートはコードとして展開し直す
2. **コマンド位置でのトークン走査**: `;` `&&` `||` `|` で切ったセグメントの先頭、`env` `sudo` `-C /repo` `--git-dir x` などを飛ばした先の語だけを見る。
   クォートで割れた語 (`git 'commit'`) はサブコマンドを「特定できない」として拒否側に倒し、クォートを剥がして `commit` と解釈しない
   (剥がし始めると `git $(echo commit)` まで追う羽目になる)。
   ヒアドキュメントの本文は bash が決して実行しない位置なので、そこを「実行体を特定できない段」として数えない。数えると、
   本文に禁止語が含まれるだけで縮退の拒否が発火する (後継プロジェクトで登録 3 回目に踏んだ)
3. **保守的フォールバック**: 静的に読めない入力は従来の部分一致 (ブロック側) へ縮退する。対象は次の 3 つ
   - 文字列をコードとして受け取る実行系 (`eval` `xargs` `find` `bash -c` 等) がコマンド位置にある。`bash` 単体は正規のラッパー呼び出し
     (`bash scripts/create-commit.sh`) を止めてしまうので、`-c` 等のコード指定オプション併用時だけ対象にする
   - 8192 バイトを超える 1 行。正規化が特殊文字数に対して二乗のコストを持ち、PreToolUse の timeout に達すると hook が効かないまま素通りになる
   - ライブラリを読めない環境 (bash 4.3 未満、配布漏れ、構文エラー)

判定ロジックは外部コマンドを一切呼ばない純粋 bash 関数として切り出す (コマンド置換もパイプも無し)。hook はすべてのツール呼び出しで走るホットパスで、
git bash では外部プロセス起動が約 95ms/回かかる。短い入力の実測 (Linux) は 432ms → 98ms。18KB のヒアドキュメントでは逆に 3 倍遅くなるが、
git bash の fork コストが桁で大きいことを見込んで fork 0 回を優先した (git bash 実機では未実測)。

### 失敗の向き

| 誤りの向き | 結果 | 回復手段 |
|---|---|---|
| 誤検知 (実行でないものをブロック) | エージェントが一手止まる。理由が返るので書き直せる | ある (本文をファイルへ逃がす等) |
| 素通り (実行を見逃す) | 強制の仕組み自体が無意味になる | 無い (起きたことに気づけない) |

判断がつかないときは必ずブロック側へ倒す。

## 適用条件

- 効く: 「エージェントが普通に書いたコマンド文字列を正しく分類する」こと。既定動作を確実な方向へ倒す仕組み
- 効かない: 敵対的な安全境界。意図的な文字列分割 (`git "com""mit"`)、変数展開、alias 経由は対象外で、完全なシェルパーサ (数千行) を書いても守れる範囲は広がらない
- `settings.json` の hook に `if` を足さない。公式は `if` を best-effort と明記しており、照合は「最初の `*` より前を書いたとおり」なので
  `Bash(git commit *)` は `git -C /repo commit`、`/usr/bin/git commit`、`bash -c "git commit"` に一致しない。前置フィルタが精密判定の超集合にならず、
  この判定に届かない入力ができる ([ガードの判定はスクリプト 1 箇所に集め settings.json には入口だけを置く](guard-config-lives-in-one-script.md))

## トレードオフ

- 得る: 20 ケースの実測が 13/20 → 20/20 (誤検知 6 件・検知漏れ 1 件が消え、`git -C /repo commit` の素通りも直った)
- 失う: 縮退時 (長い 1 行・読めない実行体・古い bash) には部分一致が残るので、回避ルールを一律には削除できない
- 敵対的レビューで 2 件の機能後退が見つかった。行継続 (`git \`+改行+`commit`) とグローバルオプション (`git --git-dir /x/.git commit`)。
  自分で用意した検証表は「変更前に誤検知していたもの」中心で、「変更前に正しく検知できていたもの」が薄かった。
  **判定を狭める変更では、狭めた結果こぼれるものを先に列挙する**

## 関連

- [生の文字列でコマンドを判定すると引用符とコメントに誤爆する](regex-command-match-misfires.md)。同じ問題の Python (shlex) 版。こちらは bash だけで済ませたいとき
- [hook の前置フィルタは精密判定の超集合でなければならない](hook-prefilter-must-stay-superset.md)。この判定の前に置く足切りの設計
- [タイムアウトした hook はガードにならず素通りする](hook-timeout-fails-open.md)。8KB 上限の理由
- [権限は permissions.deny ではなく PreToolUse hook で止める](deny-by-hook-not-permissions.md)
