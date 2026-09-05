---
type: pitfall
nature: fact
title: Grep ツールは .gitignore に載ったファイルを検索しない
description: >-
  Explains why Claude Code's Grep tool returns zero matches for files that clearly exist:
  it is ripgrep, so .gitignore / .ignore / global gitignore are applied by default, while the
  Glob tool ignores them and hidden dot-directories are still searched. Use when a search comes
  back empty for build output, logs, .env, or other generated files, or when Glob lists a file
  that Grep cannot find. Not for permission denials, ripgrep regex syntax errors, or the
  separate question of which files the agent is allowed to read.
tags: [claude-code, workflow]
keywords: [Grep, Glob, ripgrep, gitignore, 除外, 検索されない, No files found, dist, node_modules, 生成物, --no-ignore, hidden]
status: stable
verified_at: 2026-09-05
applies_to: [claude-code@2.1, ripgrep@14.1]
sources:
  - https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md
stale_after: 2027-03-05
---

# Grep ツールは .gitignore に載ったファイルを検索しない

## 症状

ファイルが確かに存在するのに、Grep ツールが該当なしを返す。

```
Found 0 files
```

対象になりやすいのは `.gitignore` に書いた生成物。ビルド出力 (`dist/`)、`node_modules/`、
ログ、`.env`、このリポジトリでいえば `**/index.jsonl` と `wip/local/` が該当する。

Glob ツールでは同じファイルが出てくるので、「Glob には出るのに Grep では引っかからない」という
食い違いになる。ここで「ファイルが無い」と結論すると誤る。

## 原因

Grep ツールの実体は ripgrep で、既定の無視規則がそのまま効いている。

- ripgrep は `.gitignore` `.ignore` `.rgignore` とグローバルの gitignore を既定で適用する
- 一方で隠しファイルの除外は無効化されている。`.claude/` のようなドットで始まるディレクトリは検索される。
  素の `rg` は隠しファイルを飛ばすので、ここだけ既定と違う (`--hidden` 相当が付いている)
- Glob ツールには無視規則が掛かっていない
- Read / Edit / Write にも無視規則は掛かっていない。無視されたファイルもそのまま読めて書き換えられる

つまり無視規則が効くのは Grep だけで、しかもその Grep は隠しファイルを見る。
「隠しファイルは見るが、gitignore されたものは見ない」という組み合わせになっている。

パスが分かっているなら Read でそのまま中身を取れる。詰まるのは「どこにあるか分からないものを探す」ときだけ。

## 回避策

| やりたいこと | 方法 |
|---|---|
| 無視されたディレクトリの中を検索する | Grep の `path` にそのディレクトリ自身を渡す |
| 無視設定ごとリポジトリ全体を検索する | Bash で `rg --no-ignore -l <pattern>` |
| 存在を確かめるだけ | Glob を使う (無視規則が掛からない) |

`path` を渡す方法には注意点がある。ripgrep はコマンドラインで明示したパスそのものには無視規則を適用しないが、
その配下の走査には適用する。`wip/*` で無視している構成なら、`path: wip/local` は見つかるが
`path: wip` は見つからない。

エージェントに探させる前提の生成物を `.gitignore` に入れるなら、置き場所を決める時点でこの非対称を織り込む。
このリポジトリが `wip/local/` を「追跡しないが `git status` には出す」設計にしているのも同じ発想で、
無視した先は検索から外れることを前提に、拾い直せる入口を残している。

## 再現条件

Windows (Git Bash)、claude-code 2.1.235、ripgrep 14.1.1 で確認した。
`wip/local/` 配下 (無視される) と `probe-visible.md` (無視されない) で実測した。

| 呼び出し | 無視されるファイル | 無視されないファイル |
|---|---|---|
| Grep (path 指定なし) | 出ない | 出る |
| Grep (`path: wip`) | 出ない | — |
| Grep (`path: wip/local`) | 出る | — |
| Glob (`**/probe*`) | 出る | 出る |
| Bash の `rg -l <pattern> .` | 出ない | 出る |
| Read | 読めた | 読めた |
| Edit | 書き換えられた | — |
| Write | 新規作成できた | — |

素の ripgrep と Grep ツールの結果は一致した。隠しディレクトリだけは Grep ツールが素の `rg` より広く、
`rg --hidden` と同じ結果になった。

## 関連

- [生のコマンド実行を deny してラッパスクリプトへ誘導する](../hook/command-wrappers-instead-of-raw-bash.md)
