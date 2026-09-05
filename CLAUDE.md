# CLAUDE.md

## 挨拶と言語

- 日本語でやりとりすること
- 最初の挨拶は自然な日本語で返すこと
- ですますなどの丁寧な口調は不要

## 役割

エージェント開発で得た知見を集約するリポジトリ。本文は日本語で書く。業務由来の知見は書かない。

## 必ず守ること

- knowledge/ inbox/ adr/ slides/ の markdown を作る・直すときは skill を使う: 追加は `knowledge-add`、スライドは `slide-make`、鮮度点検は `knowledge-audit`
- 規約は .claude/rules/ にある。frontmatter は markdown-frontmatter.md、配置と命名は directory-layout.md、本文の書き方は knowledge-authoring.md
- type と tags の語彙は taxonomy.yml が正。無い語は使わず、必要なら taxonomy.yml に追加してから使う
- 変更後は `pnpm check` (lint + index) を通す。error が残る状態で終えない
- コミットは `commit` skill を使う。prefix + 日本語 1 行、フッターは付けない、`git add .` は使わない
- スクリプトは TypeScript (tsx、pnpm) が既定。xlsx / docx / pptx 生成や pandas が要る処理は Python (uv)。使い分けは .claude/rules/scripting.md。npm / npx / pip は使わない
- 想定環境は Windows (Git Bash) と Linux の両方。hook とスクリプトは POSIX sh と Node で書き、パスは `/` 区切りに正規化する。PowerShell 専用・bash 拡張専用の書き方をしない
- 複雑な構成図は archify で描く。白紙から書かず templates/archify/ の検証済みテンプレートをコピーして差し替える。単純な図は mermaid
- INDEX.md と index.jsonl は生成物。手で編集しない
