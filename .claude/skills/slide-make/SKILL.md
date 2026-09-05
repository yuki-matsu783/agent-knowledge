---
name: slide-make
description: >-
  Create a Marp markdown deck in slides/ derived from an existing knowledge file and build it to a
  PowerPoint-like HTML with this repository's theme. Use when the user asks for slides, a presentation,
  or an HTML deck about a topic already captured under knowledge/. Not for writing the knowledge itself
  (use knowledge-add) and not for exporting to PPTX (see the marpx note in knowledge/).
---

# slide-make

knowledge/ の内容から Marp スライドを作り、HTML を生成する手順。

## 前提

- knowledge の markdown は Marp 用に汚さない。スライドは `slides/` に別ファイルとして作り、`derived_from` で元を指す
- markdown が正、HTML は生成物。HTML を直接編集しない
- 依存は `pnpm install` 済みであること (marp-cli)

## 手順

1. **元になる knowledge を確認する。** ID (例 `knowledge/foo`) を特定し、本文を読む。無ければ先に knowledge-add で作る。

2. **雛形をコピーする。** `templates/slide.md` を `slides/<元と同じ slug>.md` にコピーする。

3. **frontmatter を埋める。** `derived_from` に元の ID。`title` `tags` `status` `verified_at` `sources` は元 knowledge に合わせる。`description` は英語で、この deck が何を誰向けに話すかと、扱わない範囲を書く。Marp のディレクティブ (`marp` `theme` `paginate`) は雛形のまま残す。

4. **構成を組む。** 目安は 6〜12 枚。
   - 表紙 (`<!-- _class: lead -->`)
   - 結論 (3 点以内)
   - 背景
   - 本論 (1 枚 1 メッセージ、箇条書き 5 行まで、コードは fenced code block)
   - まとめと次に読む knowledge へのパス
   - 出典
   図は mermaid ではなく箇条書きか表にする (Marp は mermaid を描画しない)。複雑な構成図が必要なら archify skill で生成した HTML から PNG を書き出し、`slides/assets/<slug>/` に置いて `![](assets/...)` で貼る。

5. **生成する。**
   ```sh
   pnpm slides slides/<slug>.md
   ```
   `slides/<slug>.html` が生成され、先頭にコメント形式の frontmatter が付く。

6. **確認する。** ブラウザで HTML を開いて、はみ出し・文字化け・空スライドが無いか見る。直すのは markdown 側。直したら再生成する。

7. **検査する。** `pnpm check` を通す。HTML もコミット対象 (成果物として共有するため)。

## テーマ

`templates/marp-theme.css` の `agent-knowledge` テーマを使う。見た目を変えたいときはこの CSS を直し、全スライドを `pnpm slides` で再生成する。

## PPTX が必要なとき

marp-cli の `--pptx` は各スライドが画像になり編集できない。編集可能な PPTX が要る場合は knowledge/marpx-editable-pptx-from-marp.md を参照 (Python + uv の外部ツール、未検証)。
