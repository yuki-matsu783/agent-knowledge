---
name: commit
description: >-
  Create one or more atomic git commits in this repository with a Conventional Commits prefix and a
  one-line Japanese description, after running `pnpm check` and filtering out credentials and build
  junk. Use whenever a commit is made here, both when the user types /commit and whenever the agent
  commits on its own after finishing a change. Not for writing or fixing the content itself (use
  knowledge-add / slide-make) and not for push, branch, or PR operations.
---

# commit

変更内容を分析して Conventional Commits の prefix + 日本語 1 行のメッセージを作り、確認を挟まずコミットまで進める。
このリポジトリでコミットを作るときは、ユーザーが `/commit` と打った場合も、エージェントが作業の締めに自分でコミットする場合も、この手順に従う。

## 絶対ルール

- **フッターを付けない。** `Co-Authored-By` も `Generated with` も書かない。メッセージは 1 行だけ (このリポジトリの決定。ハーネス既定の帰属指示より優先する)
- **`git add .` / `git add -A` を使わない。** 必ずパスを個別指定する
- **`--no-verify` を使わない。** pre-commit が落ちたら原因を直す
- **`git commit --amend` を使わない。** 常に新規コミット
- **失敗しても `git reset` などで自動的に巻き戻さない。** 状況を報告して判断を仰ぐ
- **TodoWrite と Agent ツールを使わない**

## 手順

### 1. 現状を把握する

並列で実行する。

- `git status` (`-uall` は付けない)
- `git diff` と `git diff --cached`
- `git log --oneline -10` (既存のスタイル確認)

コミット対象の決め方。

- **既にステージ済みの変更があるとき** → それが意図された範囲。追加でステージしない。unstaged / untracked が残っていてもユーザーに聞かず対象外にする
- **何もステージされていないとき** → 作業ツリーの変更 (unstaged + untracked) を対象にし、手順 3 のフィルタを通してから個別に `git add` する
- **どちらも空のとき** → 「コミットする変更がありません」と伝えて終了する

### 2. `pnpm check` を通す

knowledge/ adr/ slides/ taxonomy.yml のどれかが変わっているなら必ず実行する。error が残っている状態でコミットしない。
INDEX.md は生成物なので手で直さない。`pnpm check` が更新したぶんは、その知識ファイルと同じコミットに含める
(`.githooks/pre-commit` が有効なら自動でステージされるが、有効でない環境でも落ちないよう明示的に `git add INDEX.md` してよい)。

### 3. prefix と論理的まとまりを決める

| prefix | このリポジトリでの対象 |
|---|---|
| `docs` | knowledge/ adr/ slides/ README.md の本文 |
| `ai-asset` | `.claude/` 配下 (rules / skills / hooks / settings.json) と CLAUDE.md。エージェント向けの指示は docs ではなくこちら |
| `feat` | scripts/ への機能追加 |
| `fix` | scripts/ や hook のバグ修正 |
| `refactor` | 挙動を変えないコード整理 |
| `test` | テストの追加・修正 |
| `chore` | taxonomy.yml、templates/、依存更新、雑務 |
| `build` | package.json / pyproject.toml / ロックファイル |
| `ci` | CI 設定 |
| `perf` | 性能改善 |
| `style` | 意味に影響しない整形 |
| `revert` | 取り消し |

prefix が変わるか、扱っている主題が別なら別コミットに分ける。**説明が 1 行に収まらないと感じたら、それはコミットを分ける合図**。

### 4. ファイルをフィルタする

`git add` の対象から自動的に除外する。除外にユーザーの確認は要らない。

**クレデンシャル (絶対に除外)**
`.env` / `.env.*` / `*.pem` / `*.key` / `*.p12` / `*.pfx` / `*.ppk` / `credentials.json` / `service-account*.json` / `id_rsa` / `id_ed25519` / `id_ecdsa` / `.aws/credentials` / `.netrc` / `secrets.yml` / `secrets.yaml`

**開発環境の副産物**
`.DS_Store` / `Thumbs.db` / `desktop.ini` / `*.swp` / `*.swo` / `*~` / `node_modules/` / `.venv/` / `__pycache__/` / `*.pyc` / `.ruff_cache/` / `dist/` / `build/` / `out/` / `*.log` / `tmp/` / `*.tmp` / `*.tmp.*` / `*.bak` / `*.orig` / `*.stackdump` (Git Bash のクラッシュダンプ) / `.claude/settings.local.json` / `**/index.jsonl` / `templates/archify/preview/`

多くは `.gitignore` にも入っているが、**この一覧が最後の砦**。`.gitignore` に無い新種の副産物を見つけたら、この一覧と `.gitignore` の両方に足す。

**削除されたファイルは除外対象ではない。** `git status` で `D` になっているパスも、他と同じように `--` の後ろに並べて `git add` してよい。

除外したファイルがあれば、コミット前にチャットへ列挙する。

### 5. コミットする

**承認待ちをしない。** AskUserQuestion を挟まず、そのまま実行する。実行前に、メッセージ (複数なら分割案) と除外したファイルをチャット本文に書く。透明性のためであって確認のためではない。

```sh
git add -- <file1> <file2>
git commit -m "<prefix>: <日本語の説明>"
```

複数コミットに分けるときは、この 2 コマンドを組ごとに順番に繰り返す。分割案の書き方。

```
コミット1: docs: hook でツール操作を止める知見を 2 件追加
  - knowledge/ticket-scoped-deny-hook.md
  - knowledge/hook-timeout-fails-open.md
  - INDEX.md
コミット2: chore: taxonomy.yml に observability タグを追加
  - taxonomy.yml
```

## 失敗したとき

- **pre-commit が落ちた** → 出力をそのまま見せ、原因 (ほぼ frontmatter lint の error) を直してから新規コミットを作る。`--amend` も `--no-verify` も使わない
- **複数コミットの途中で落ちた** → そこで停止する。`git status` を出して、どこまで完了したかを報告する。自動で巻き戻さない
- **`node` が PATH に無い等で pre-commit がスキップされた** → `pnpm check` を自分で実行してからコミットする
