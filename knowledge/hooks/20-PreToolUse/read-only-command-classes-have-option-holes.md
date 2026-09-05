---
type: pitfall
nature: fact
title: 読み取り専用に分類したコマンドはオプションで状態を変えたり任意実行したりする
description: >-
  Lists the reverse holes found in a command-classification guard that lets "read-only" commands through
  without a declaration: `git -c diff.external=<cmd> diff` executes an arbitrary command while classified as
  read, `git branch -d`, `git symbolic-ref <name> <ref>`, `git reflog expire`, `git diff --output=<file>` write
  state, and `curl -T / -d / -F / -X POST` and `wget --post-file` send data out. Explains the chosen fix:
  add subcommand-plus-option checks at exactly six places, treat global `-c` / `--config-env` as unknown without
  enumerating dangerous config names (any list leaks), keep `cd` out of the read class because it shifts the
  path-judgment origin, and leave every other unknown as default-deny. Use when a whitelist of read-only
  commands sits in front of a default-deny guard. Not a complete catalogue of git or curl options.
tags: [claude-code, security]
keywords: [読み取り専用, 白名簿, 既定拒否, git -c, diff.external, --config-env, branch -d, symbolic-ref, reflog expire, --output, curl -T, curl -d, curl -X POST, wget --post-file, cd, 判定の起点, 逆向きの穴, scope_classify, unknown]
status: stable
sources:
  - https://git-scm.com/docs/git#Documentation/git.txt--cltnamegtltvaluegt
  - https://curl.se/docs/manpage.html
---

# 読み取り専用に分類したコマンドはオプションで状態を変えたり任意実行したりする

## 症状

コマンドを `read` / `build-test` / `remote-write:*` などに分類し、`read` だけは宣言なしで通す guard を調べたところ、穴が 4 層に分かれた。

| 層 | 何が起きるか | 規模 |
|---|---|---|
| L1 | git のサブコマンドが unknown に落ちて通らない (`worktree` / `checkout` / `switch` / `stash` など) | 174 件中 145 件 |
| L2 | 白名簿に無い基本コマンドが通らない (`cd` を含む) | 候補 95 件中 67 語 |
| L3 | 分類より手前の正規化で実行体を取り違える | 9 件 |
| L4 | **逆向き**: `read` に分類されるのに状態を変えられる | 5 件 |

L1〜L3 は「通らない」= 手数の問題、L4 は「通ってしまう」= 統制の問題。とくに `git -c diff.external=<コマンド> diff` は `read` 分類のまま**任意コマンドを実行できる**。
同じ形が `curl` にもあった。`curl` を「外部を見る」分類で通したところ、`-T a.md <url>` / `-d @a.md` / `-F file=@a.md` / `-X POST https://api.github.com/repos/…/issues` (issue の起票そのもの) / `wget --post-file` が、
宣言だけで通るリモート書き込みになった。改定前は `curl` が既定拒否だったので、副作用としてこれらも塞がっていた。

## 原因

「コマンド名 (と第 1 サブコマンド) で分類する」設計は、副作用がオプションに隠れているコマンドを扱えない。しかも手数の側 (L1〜L3) だけを直すと、**分類を広げた記録だけが残って統制の穴が残る**。
白名簿を伸ばすほど「守っている」ように見えるが、伸ばした分だけオプションの穴も増える。

## 回避策

- **逆向きの穴だけを、サブコマンド + オプションの判定を限定して足して閉じる。** 6 か所 (`worktree` / `branch` / `symbolic-ref` / `reflog` / `--output=` / グローバル `-c`・`--config-env`)。白名簿全体をオプション込みに作り替えると git の版ごとに追随が要る。
  閉じる向き (通っていたものを止める) にしか効かない規則なら、漏れがあっても穴は増えない
- **グローバル `-c` / `--config-env` は設定名を見ずに一律 unknown に倒す。** 危険な設定名 (`diff.external` / `core.pager` / `core.sshCommand` …) の列挙は網羅できず、漏れた名前が `read` のまま通る。正当な用途は素の形で足りる
- **送信側の形は宣言の有無によらず拒否する。** `curl` の `-T` / `--upload-file` / `-d` / `--data*` / `-F` / `--form` / `-X` の値が `GET` / `HEAD` 以外、`wget` の `--post-file` / `--post-data` / `--body-*` / `--method` が `GET` / `HEAD` 以外。
  「外部を見てよい」の宣言は「外部に書いてよい」の宣言ではない。オプション名は前方一致 (等号形 `--data-binary=@a.md` を含む) で拾えば足り、`getopt` 相当の解析は要らない
- **出力先を持つ形は書き込みとして先に判定する。** `curl -o` / `-O` / `--output` / `--remote-name`、`wget` の既定動作と `-O <file>`。判定は順序付きにする (最も強い拒否を先)。`curl -T a.md -o out <url>` のように両方持つ形があるので独立条件では書けない。
  出力先の取り出しは引数列を先頭から走査して `-o` の**次の語**を取る。オプションを機械的に落とす関数を当てると URL と出力先を区別できない。`://` を含む語は URL
- **`cd` は `read` に足さない。** 書き込み先の解決は作業ツリー基準で相対パスを畳むだけで `cd` を追跡しない。`cd` を通すと `cd <他の場所> && echo x > a.txt` の `a.txt` が自分の作業ツリーの相対パスとして判定され、外への書き込みが通る。
  起点を追跡する実装は fork ゼロ・段ごとに独立判定というホットパスの制約と噛み合わない。作業ツリーの中で作業するなら作業ディレクトリは最初からそこで、`cd` は要らない
- L1・L2 の残りは既定拒否のまま残す。必要な操作 (worktree の作成・合流・片付け) は分類を広げず提供コマンドで通す。提供コマンドと宣言は、どちらも記録が残る口
- `git worktree list` のように読み取りだけの形は、サブコマンドの次の語で限定して `read` に落とす。`worktree` を丸ごと `read` にすると `add` / `remove --force` まで通る

## 再現条件

純 bash でコマンド列を分類する PreToolUse guard。git 2.x、curl 7.x / 8.x のオプション体系による。

## 関連

- [分類を広げるときは新たに通るものを数える](count-what-newly-passes-when-widening-a-class.md)。`curl` の改定で送信側が開いた経緯
- [削除は保護 glob が対象で始まるかで判定し配下を列挙しない](judge-deletes-by-protected-glob-prefix.md)。同じ guard の削除側
- [共有ライブラリは分類までにし規約との照合は呼び手が行う](../scripts/shared-library-classifies-caller-matches-rules.md)。`-o` の次が出力先、という意味論を持つのは呼び手
- [生のコマンド実行を deny してラッパスクリプトへ誘導する](command-wrappers-instead-of-raw-bash.md)
