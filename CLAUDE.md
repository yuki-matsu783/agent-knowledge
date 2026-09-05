# CLAUDE.md

## 挨拶と言語

- 日本語でやりとりすること
- 最初の挨拶は自然な日本語で返すこと
- ですますなどの丁寧な口調は不要

## 役割

エージェント開発で得た知見を集約するリポジトリ。本文は日本語で書く。業務由来の知見は書かない。

## 前提

書いてある版は 2026-09-05 時点の実測値。知見を書くときは自分の手元の版を確かめて applies_to に残す。

### 対象エージェント

- Claude Code 2.1 が中心。一部 Gemini CLI 0.58、まれに Google Antigravity 1.1
- 知見はこれらで確かめたことを書く。主語を省かず、どのツールの話か本文で分かるようにする
- 他のツールにも当てはまりそうでも、確かめたのが 1 つだけならその旨を書く
- 確かめた製品は frontmatter の applies_to に `claude-code@2.1` / `gemini-cli@0.58` / `antigravity-cli@1.1` の形で残し、tags の claude-code / gemini-cli でも示す
- applies_to のバージョンは major.minor まで。パッチまで書かない

### 動かし方

- Claude Code は **VS Code 拡張**で動かしている。知見の検証もすべて拡張の上で行っている
- ターミナルの CLI では確かめていない。CLI でも同じとは限らないので、そう読める書き方をしない
- とくに拡張と CLI で違いうるところ (キーバインド、承認プロンプトの出方、画面描画、エディタとの連携) は、拡張で見た挙動だと本文に明記する
- CLI で確かめたものは、確かめたと書く

### VCS

- git。ホスティングは GitLab が中心で GitHub も使う
- CLI は GitLab が `glab` (1.114)、GitHub が `gh` (2.97)。どちらか片方でしか確かめていない手順はその旨を書く
- 並列作業は `git worktree` で分ける。エージェントを複数走らせる話はこれが前提

### 実行環境

- Windows の Git Bash、Windows の WSL、Claude Code on the web (Linux) の 3 つ。どれでも動くように書く
- 使える道具は `jq` 1.6、Node 22 (pnpm 10)、Python 3.12 (uv)。これ以外がある前提で書かない
- Windows と Linux で挙動が変わるところ (パス区切り、改行、シンボリックリンク、大文字小文字) は知見側に明記する

## 必ず守ること

- knowledge/ slides/ の markdown を作る・直すときは skill を使う: 追加は `knowledge-add`、スライドは `slide-make`、鮮度点検は `knowledge-audit`
- 規約は .claude/rules/ にある。frontmatter は markdown-frontmatter.md、配置と命名は directory-layout.md、本文の書き方は knowledge-authoring.md
- このリポジトリの道具の説明は knowledge/ に書かない。要件は .claude/docs/00_requirement/、仕様は .claude/docs/10_spec/。requirement は外から観測できることだけを EARS 形式で書き、内部の挙動と設計判断は spec に置く。規約は .claude/rules/repo-docs.md
- type と tags の語彙は taxonomy.yml が正。無い語は使わず、必要なら taxonomy.yml に追加してから使う
- 変更後は `pnpm check` (lint + index) を通す。error が残る状態で終えない
- コミットは `commit` skill を使う。prefix + 日本語 1 行、フッターは付けない、`git add .` は使わない
- スクリプトは TypeScript (tsx、pnpm) が既定。xlsx / docx / pptx 生成や pandas が要る処理は Python (uv)。使い分けは .claude/rules/scripting.md。npm / npx / pip は使わない
- hook とスクリプトは前提の実行環境すべてで動かす。POSIX sh と Node で書き、パスは `/` 区切りに正規化する。PowerShell 専用・bash 拡張専用の書き方をしない
- 複雑な構成図は archify で描く。白紙から書かず templates/archify/ の検証済みテンプレートをコピーして差し替える。単純な図は mermaid
- INDEX.md と index.jsonl は生成物。手で編集しない
