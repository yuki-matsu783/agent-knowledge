# ディレクトリ体系・命名・リンク規約

## ディレクトリ

```
knowledge/     # 確定した知識。主題ディレクトリは当面作らず直下に置く (20 件を超えたら主題で切る)
inbox/         # 未整理メモ (type: note)。整理後に knowledge/ へ昇格させる
adr/           # このリポジトリの運用・設計の決定記録 (type: adr)
slides/        # Marp 形式の markdown (type: slide) と生成した HTML
templates/     # 各 type の雛形と Marp テーマ
scripts/       # lint・index・slides・audit (TypeScript、tsx で実行、pnpm)
taxonomy.yml   # type と tags の統制語彙
INDEX.md       # 自動生成の一覧。手で編集しない
.claude/rules  # 規約 (常時読み込み)
.claude/skills # 作業手順 (knowledge-add / slide-make / knowledge-audit)
```

主題分類は tags が担う。ディレクトリを主題で切るのは knowledge/ が 20 件を超えてからにする。
切ったときはディレクトリ名も ID の一部になるので、リンクと superseded_by と derived_from を合わせて更新する。

## ファイル名

- ASCII の kebab-case のみ (`^[a-z0-9]+(-[a-z0-9]+)*\.md$`)。日本語ファイル名は使わない
- 日本語の名前は frontmatter の `title` に書く
- ファイル名は内容を表す名詞句にする。日付 prefix は付けない (inbox/ でも付けない。日付は git が持つ)
- adr/ は `NNNN-slug.md` の連番

## ID

ID = リポジトリルートからの相対パスから `.md` を除いたもの。`superseded_by` と `derived_from` はこの ID で参照する。
ファイルを移動・改名すると ID が変わるので、参照元を必ず更新する (lint が検出する)。

## リンク

- 本文内の相互リンクは相対パスの markdown リンクのみ (`[title](../knowledge/foo.md)`)
- wikilink `[[...]]` とルート絶対パス `/knowledge/foo.md` は使わない (lint が error にする)
- リンク先の存在は lint が検査する

## 生成物

| ファイル | 生成元 | git |
|---|---|---|
| `INDEX.md` | `pnpm index` | コミットする |
| `<dir>/index.jsonl` | `pnpm index` (SessionStart hook でも再生成) | gitignore |
| `slides/*.html` | `pnpm slides` | コミットする (成果物として共有するため) |
| `knowledge/diagrams/*.html` | `pnpm diagrams` | コミットする (knowledge からリンクされる成果物) |
| `templates/archify/preview/*.html` | `pnpm diagrams` | gitignore (1 本 700KB。テンプレートの確認用) |
| `*.xlsx` | `pnpm xlsx` | 共有する成果物だけコミットする |
