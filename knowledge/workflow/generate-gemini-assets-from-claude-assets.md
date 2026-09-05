---
type: pattern
nature: best-practice
title: .gemini/ は .claude/ からの変換生成物にして Git 管理下に置くべき
description: >-
  A pattern for running the same rules, skills, hooks, and subagent definitions under both Claude Code and
  Gemini CLI: keep .claude/ as the only hand-written source, generate .gemini/ from it with a converter that
  maps vocabulary (PreToolUse to BeforeTool, Read to read_file), strips frontmatter keys that Gemini's strict
  agent schema rejects, replaces the whole tree rather than diffing, and fails loudly on any key it cannot
  map; then commit the generated tree. Use when symlinks or junctions between the two directories have
  failed, or when Gemini refuses to load an agents/*.md that Claude accepts. Not for a single-CLI repository,
  and not a claim that the converted assets have been load-tested in Gemini CLI, which the source project
  could not verify.
tags: [gemini-cli, claude-code, workflow]
keywords: [.gemini, .claude, 変換, 生成物, localAgentSchema, strict, BeforeTool, AfterTool, read_file, settings.json, 語彙差, 二重管理, 丸ごと置き換え, 除外リスト, sync-gemini-assets]
status: stable
sources:
  - https://geminicli.com/docs/hooks/reference/
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
intervention: tool
---

# .gemini/ を .claude/ からの変換生成物にして Git 管理下に置く

## 課題

Claude Code と Gemini CLI で rules・skills・hooks・agents を二重管理したくない。最初の設計は `.gemini/` の各ディレクトリを `.claude/` へのローカルリンクにする
ものだったが、2 つの理由で成り立たなかった。

1. **リンクでは記法差を吸収できない。** gemini-cli の `agentLoader.ts` の `localAgentSchema` は `.strict()` で、Claude 側の frontmatter に `type` / `tags` /
   `keywords` が 1 つ残るだけでロードが失敗する。settings も `PreToolUse` → `BeforeTool`、ツール名 `Read` → `read_file` のように語彙が違う
2. リンクは `.gitignore` 対象なのでリポジトリを見ても中身が分からず、配布先でリンク生成を忘れると Gemini からは資産がゼロになる。
   Windows のジャンクションは git がリンクとして扱わない別の問題もある ([ntfs-junction-is-not-a-git-symlink.md](ntfs-junction-is-not-a-git-symlink.md))

リンク運用を続けるには `.claude/` 側を両者が読める最大公約数へ寄せるしかなく、それは Claude 側の規約 (検索用 frontmatter) を Gemini の制約に従わせることになる。

## 解決

- `.gemini/` を「手で書く実体」ではなく「`.claude/` から機械的に決まる生成物」にする。変換スクリプトが記法差を吸収する
- **生成物だが Git 管理下に置いてコミットする。** 配布先で再生成を忘れても資産が消えず、変換結果をレビューできる
- 変換は**丸ごと置き換え**。差分更新だと `.claude/` 側で削除・改名したファイルが残り続ける。`.gemini/` の直接編集は認めない
- **変換できないものは黙って落とさず、エラーで停止する**か、理由付きの除外リストへ載せる。黙って落とすと Gemini 側が必要な権限や設定を失ったまま静かに動き、
  単体テストは「変換が通った」ことしか見ないので永久に緑のまま。実際に `.claude/settings.json` へ `env` を足したときにこの停止が働いて発覚した
- 配布物には `.gemini/` を含めず、配布先で 1 回生成する。配布時点のスナップショットは配布先が独自に足したスキルと食い違う

## 適用条件

- 効く: 両 CLI を同じリポジトリで使い、`.claude/` 側に独自の frontmatter や hook 体系がある
- 効かない: 片方しか使わない。あるいは両者が読める最小限の書き方で済む小さな設定

## トレードオフ

- 得る: `.claude/` は自分の規約のまま書ける。制約を持つ側 (Gemini) に合わせる処理を、その側の生成物の中だけへ閉じ込められる
- 失う: 生成物をコミットする冗長さ。コンフリクトは片側を捨てて再生成すればよい
- 受け入れた制約 (外部の制約であって実装の欠陥ではない): Gemini 経路では `permissions` 相当の policy engine が無効なのでコミット強制が hook 1 枚になる。
  変換後の `.gemini/` を Gemini CLI が実際にロードできることは元プロジェクトでは未確認 (変換規則はソースコードを読んで決めた)

## 関連

- [NTFS ジャンクションは git にリンクとして扱われず中身が丸ごとコミットされる](ntfs-junction-is-not-a-git-symlink.md)
- [Gemini CLI には圧縮後に発火する hook が無い](../hooks/01-PreCompact/gemini-cli-no-post-compress-hook.md)。変換しても埋まらない機能差
- [ConfigChange と FileChanged に頼ったガードは他のエージェント CLI へ移植できない](../hooks/common/hook-event-portability-across-agent-clis.md)
- [生成物を Git 管理下に置くかは人間が直接読むかで決める](committed-vs-ignored-generated-files.md)
