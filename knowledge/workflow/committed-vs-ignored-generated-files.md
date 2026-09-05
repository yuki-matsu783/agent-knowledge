---
type: pattern
nature: heuristic
title: 生成物を Git 管理下に置くかは人間が直接読むかで決めた方がよさそう
description: >-
  A rule for generated files in an agent-maintained repository: gitignore and regenerate on SessionStart the
  machine-readable intermediates nobody opens (a frontmatter index.jsonl), but commit generated artefacts
  that humans read on GitHub, that must exist right after clone, or that must stay visible to ripgrep-based
  search (a README table of decision records, a converted .gemini/ tree); and never regenerate a committed
  artefact from a hook, because unrelated diffs would appear in the working tree on every session. Use when
  deciding where a new generated file goes, or when index files keep causing merge conflicts and forgotten
  regeneration commits. Not for build output of an application, and not a claim that "generated therefore
  ignored" is a general rule.
tags: [workflow, meta]
keywords: [生成物, .gitignore, index.jsonl, SessionStart, 再生成, マージコンフリクト, 流し忘れ, README 一覧, マーカー区間, --check, 人間が読む, clone 直後, ripgrep, Grep ツール, 勝手な差分, 原子的更新]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# 生成物を Git 管理下に置くかは人間が直接読むかで決める

## 課題

frontmatter から生成する `index.jsonl` を Git 管理下に置いて「更新したら手で再生成してコミットする」運用にしていると、2 つの構造的な問題が出る。
複数ブランチが別々の markdown を編集すると生成物の近接行が競合する。再生成をコミット前に忘れると「`index.jsonl` だけを直す追加コミット」が発生する。
一方、決定記録の一覧 (README の表) を同じ理由で Git 管理外にすると、今度は別のものが壊れる。「生成物だから Git 管理外」は一般則ではない。

## 解決

分かれ目は**人間やレビューが直接読むかどうか**。

| 生成物 | 扱い | 理由 |
|---|---|---|
| `index.jsonl` (検索用の機械可読インデックス) | `.gitignore` に入れ、SessionStart hook でセッション開始のたびに再生成する | 人間は読まない。Git から外れた時点でコンフリクトと流し忘れは構造的に消える。hook は stdout を捨て、失敗してもセッション開始をブロックしない |
| README 内の決定記録一覧 | 生成するが**Git 管理下に残す**。README 内をマーカーで囲んだ区間に出力し、マーカーが片方でも無ければ推測せずエラーで止める | GitHub 上で人間が開く目次。Git 管理外だと clone 直後に無く、Claude Code の Grep ツール (ripgrep) は `.gitignore` を尊重するので全文探索からも消える |
| 別 CLI 向けに変換した資産 (`.gemini/`) | 生成するが Git 管理下に残す | 配布先で再生成を忘れると資産がゼロになる。変換が正しいかをレビューできる |

**Git 管理下の生成物は hook で自動生成しない。** SessionStart で生成すると、コミットするつもりのない差分が `git status` に出続ける。
`index.jsonl` を毎セッション自動生成できるのは Git 管理外だからで、この違いがそのまま自動化の可否を分ける。実行忘れは `--check` (終了コード 2) で検出する。

コミットする生成物のコンフリクトは、統合せず片側を捨てて再生成すればよい。「捨てた側を機械的に作り直せる場合に限る」という条件を、
「片側を丸ごと採用しない」という解消ルールの例外として明記しておく (新しい手順を足すときは同じファイルの禁止事項が古くなっていないか見る)。

frontmatter から導けない散文の注記は、サイドカーファイルではなく元ファイルの frontmatter に `note` キーとして持たせる。サイドカーは同期の手間が戻り、そのファイル自体が新たなコンフリクト源になる。

## 適用条件

- 効く: エージェントが複数ブランチで並行して markdown を増やすリポジトリ
- 効かない: アプリケーションのビルド成果物。それは通常どおり管理外

## トレードオフ

- 得る: 生成物由来のコンフリクトと「直し忘れコミット」が消える。人間が読むものは常に見える
- 失う: 管理外の生成物は同一セッション内で編集しても次のセッション開始まで更新されない (必要なら手で再生成する)。管理下の生成物は「生成物なのにコミットされる」冗長さが残る
- 生成スクリプトが走査中に出力を直接 truncate して追記すると、中断で既存ファイルが壊れる。全走査後に一時ファイルへ書いて `mv` で差し替え、内容が同じなら書き換えない

## 関連

- [Grep ツールは .gitignore に載ったファイルを検索しない](grep-tool-skips-gitignored-files.md)。管理外にすると探索から消える根拠
- [.gemini/ を .claude/ からの変換生成物にして Git 管理下に置く](generate-gemini-assets-from-claude-assets.md)
- [連番 ID はブランチ並行で必ず衝突し git はそれを報告しない](sequential-ids-collide-across-branches.md)。一覧を生成物にしても番号自体の衝突は残る
