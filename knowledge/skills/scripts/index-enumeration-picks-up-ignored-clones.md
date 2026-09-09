---
type: pitfall
nature: fact
title: gitignore 対象のインデックスを fs 走査で集めると無視ディレクトリの残置インデックスまで検索に入る
description: >-
  Explains why a frontmatter index search returns documents whose paths do not exist in the
  repository: the generator enumerates markdown with git ls-files so ignored directories never
  enter it, but the search side cannot use git ls-files because index.jsonl is itself gitignored,
  so it walks the filesystem and picks up a stale index.jsonl left inside an ignored directory such
  as a cloned reference repository, whose rows carry the other repository's paths. Gives the fix
  (start the walk from the declared scope directories rather than excluding only .git and
  node_modules) and the matching rule for the generator, where find visits every ignored file while
  git ls-files does not. Use when an index-based document search returns unknown or dead paths, or
  when a full-repository frontmatter scan suddenly takes minutes. Not for the Grep tool skipping
  gitignored files, and not for merge conflicts in committed index files.
tags: [workflow, meta, observability]
keywords:
  - index.jsonl
  - git ls-files
  - find
  - git check-ignore
  - .gitignore
  - 参考ディレクトリ
  - 残置インデックス
  - 実在しないパス
  - concept_id
  - 走査コスト
  - タイムアウト
  - --exclude-standard
  - 生成物
  - fs 再帰走査
status: stable
verified_at: 2026-09-09
applies_to: [claude-code@2.1]
sources:
  - https://git-scm.com/docs/git-ls-files
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# gitignore 対象のインデックスを fs 走査で集めると無視ディレクトリの残置インデックスまで検索に入る

## 症状

frontmatter インデックスの属性検索が、そのリポジトリに存在しないパスの文書を返す。

```
ddr    .claude/docs/ddr/i0038-01-ドキュメント探索はfrontmatterインデックス検索を第一手段にする    ...
```

`.claude/docs/ddr/` は無い。それでも検索は 77 件を上乗せして返し、件数サマリのインデックス数だけが 1 つ多い。パスを Read しようとして初めて存在しないと分かる。

作った側から見ると原因が見えにくい。インデックスの生成 (`git ls-files` を使う側) は正しく動いていて、無視ディレクトリの markdown は 1 件も入っていない。壊れているのは検索側だけになる。

## 原因

インデックスを Git 管理外の生成物にすると、生成側と検索側で列挙の手段が食い違う。

| 側 | 何を列挙するか | 手段 | gitignore |
|---|---|---|---|
| 生成 | markdown | `git ls-files --cached --others --exclude-standard` | 効く。無視されたものは列挙されない |
| 検索 | `index.jsonl` | fs の再帰走査 | 効かない。`index.jsonl` 自身が無視対象なので `git ls-files` では出てこない |

検索側は「生成物であるインデックスを集める」のだから `git ls-files` を使えない。そこで fs 走査になり、除外が `.git` と `node_modules` だけだと無視ディレクトリの中まで降りる。

外部リポジトリを丸ごと clone して `.gitignore` に入れた参照用ディレクトリが典型で、その中に元リポジトリで生成された `index.jsonl` が残っている。中身は元リポジトリのルート基準のパスなので、取り込んだ側では実在しない ID になる。インデックスは「ディレクトリごとに 1 つ、その場に置く」形が扱いやすいが、その置き方がそのまま持ち込みの経路になる。

生成側にも同じ構図の問題がある。列挙を `find` で書くと、無視ディレクトリの中の markdown まで走査する。参照用ディレクトリに 3,000 件の markdown があると `find` は 3,005 件を訪問し、`git ls-files` は 2 件で済んだ。走査コストがそのまま効くので、リポジトリルート一括の再生成がタイムアウトし、書き込み途中のインデックスが壊れた状態で残ることがある。

## 回避策

**検索側は走査の起点を宣言したスコープに限る。** 「`.git` と `node_modules` を除く全部」ではなく、「`knowledge/` と `slides/` の下だけ」のように対象を列挙する。除外リストの運用は、新しい無視ディレクトリが増えるたびに漏れる。

そのうえで次のどれかを併せる。

| 方法 | 効果 | 注意 |
|---|---|---|
| 走査対象のディレクトリを設定で持つ | 持ち込みも走査コストも消える | スコープ外に文書を置くと検索から外れる |
| `git check-ignore` で事後にふるい落とす | 正しさは満たす | 走査自体は発生するので、大量ファイルによる遅さは残る |
| インデックスを走査の要らない 1 箇所に集約する | 拾い間違いが起きない | ディレクトリ単位の差分再生成ができなくなる |

**生成側の列挙は `find` ではなく `git ls-files --cached --others --exclude-standard` にする。** 追跡済みと、未追跡だが無視対象でないものを合わせて取れる。無視されたディレクトリは走査自体が発生しない。事後フィルタと違い、正しさと速さの両方を満たす。

インデックスに実在しないパスが載りうる以上、**検索結果のパスは Read するまで実在を仮定しない。** 属性検索から Read へ渡す前に、返ってきたパスがスコープ内かを見る。

## 再現条件

Windows (Git Bash)、git 2.39、Node 22.15、claude-code 2.1 (VS Code 拡張) で確認した。

`.gitignore` に参照用ディレクトリを 1 行書いた状態で、その中に別リポジトリ由来の `index.jsonl` (77 行、61 KB) を置いた。インデックス生成 (`git ls-files` 経由) の出力には 1 件も入らず、属性検索の結果には 77 件が入り、そのすべてがこのリポジトリに存在しないパスだった。

`find` と `git ls-files` の訪問件数の差 (3,005 件 0.94 秒 / 2 件 0.54 秒) は出典の決定記録の実測値で、こちらは追試していない。

## 関連

- [ドキュメント探索は全文 grep ではなく frontmatter インデックスの属性検索から始めるべき](../frontmatter-index-search-before-grep.md)。この落とし穴が出る仕組みの全体
- [Grep ツールは .gitignore に載ったファイルを検索しない](../../workflow/grep-tool-skips-gitignored-files.md)。無視の非対称がツール側にも同じ形で出る
- [生成物を Git 管理下に置くかは人間が直接読むかで決めた方がよさそう](../../workflow/committed-vs-ignored-generated-files.md)
- [エージェントが呼ぶスクリプトは黙って成功してはいけない](agent-scripts-must-not-succeed-silently.md)
