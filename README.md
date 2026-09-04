# agent-knowledge

エージェント開発で得た知見を集約するリポジトリ。markdown に YAML frontmatter を付けて機械可読にし、一覧 (INDEX.md) と Marp スライドを生成する。

## 構成

```
knowledge/     確定した知識 (concept / how-to / reference / pattern / pitfall)
inbox/         未整理メモ (note)
adr/           運用・設計の決定記録
slides/        Marp markdown と生成 HTML
templates/     各 type の雛形と Marp テーマ
scripts/       lint・index・slides・audit (TypeScript、tsx で実行)
taxonomy.yml   type と tags の統制語彙
INDEX.md       自動生成の一覧
```

規約は [.claude/rules/](.claude/rules/) を参照。

## セットアップ

```sh
pnpm install                          # Node 側 (lint / index / slides / archify)
uv sync                               # Python 側 (xlsx 生成)。Python 本体は uv が用意する
git config core.hooksPath .githooks   # pre-commit で lint と INDEX.md 生成 (Claude Code からの commit のときだけ動く)
```

## コマンド

| コマンド | 内容 |
|---|---|
| `pnpm lint` | frontmatter・配置・リンクの検査 |
| `pnpm index` | INDEX.md と各ディレクトリの index.jsonl を生成 |
| `pnpm check` | lint と index をまとめて実行 |
| `pnpm slides` | slides/*.md から HTML を生成 (`pnpm slides slides/foo.md` で個別) |
| `pnpm audit` | 鮮度点検の候補を列挙 (`--days 90`) |
| `pnpm search` | frontmatter を横断検索 (`--type` `--tag` `--text` `--format` など) |
| `pnpm diagrams` | archify の図を検証して HTML 生成 (`--check` で検証のみ) |
| `pnpm xlsx <in.md|in.csv> -o out.xlsx` | markdown の表や CSV から xlsx を生成 (Python) |
| `pnpm typecheck` / `pnpm lint:py` | TypeScript の型検査 / Python の ruff |

## 図

単純な図は mermaid、複雑な構成図はプロジェクトローカルの archify skill ([.claude/skills/archify/](.claude/skills/archify/)) で生成する。

## 書き方の流れ

1. `templates/` から type に合う雛形をコピーする (Claude Code なら `knowledge-add` skill)
2. frontmatter を埋める。tags は taxonomy.yml の語彙から選ぶ
3. `pnpm check` を通す
4. スライドにするなら `slides/` に Marp markdown を作り `pnpm slides` (`slide-make` skill)
