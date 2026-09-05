---
type: pitfall
nature: fact
title: NTFS ジャンクションは git にリンクとして扱われず中身が丸ごとコミットされる
description: >-
  Explains why sharing one directory between two agent CLIs (for example .gemini/skills pointing at
  .claude/skills) with an NTFS junction on Windows ends in a duplicated tree in git: the junction's reparse
  tag is Mount Point, not IO_REPARSE_TAG_SYMLINK, so git walks into it and stages every file underneath as a
  new path, while a real symlink needs Developer Mode or admin rights that other clones may not have. Use
  when `git status` suddenly lists dozens of added files under a directory you meant as a link, or when
  deciding how to share rules, skills, and hooks across .claude/ and .gemini/. Not for Linux or macOS, where
  `ln -s` simply works, and not the recommended fix, which is to stop linking and generate instead.
tags: [workflow, gemini-cli, claude-code]
keywords: [junction, "mklink /J", symlink, 開発者モード, 管理者権限, "New-Item -ItemType SymbolicLink", "fsutil reparsepoint", "Mount Point", "0xa0000003", IO_REPARSE_TAG_SYMLINK, "120000", ".gemini", ".claude", 二重コミット, Windows]
status: stable
sources:
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# NTFS ジャンクションは git にリンクとして扱われず中身が丸ごとコミットされる

## 症状

`.gemini/docs` を `.claude/docs` へのジャンクションとして作った状態で `git status --short .gemini` を打つと、
リンク 1 エントリではなく、ジャンクションの先にある実ファイルすべてが `.gemini/docs/...` という個別の新規ファイル (`A`) として列挙される
(実例では 56 件)。このまま `git add` すると `.claude/` の内容が `.gemini/` として丸ごと二重にコミットされ、以後 `.claude` 側だけを直すと
`.gemini` 側が古いまま乖離していく。

## 原因

- Windows で本物のシンボリックリンク (`New-Item -ItemType SymbolicLink`) を作るには管理者権限か開発者モードが要る。無いセッションでは失敗するので、
  代替として `New-Item -ItemType Junction` (`mklink /J`) を使いがち
- `fsutil reparsepoint query` で見るとジャンクションのタグは `Mount Point` (`0xa0000003`) で、git が特別扱いするシンボリックリンクのタグ
  (`IO_REPARSE_TAG_SYMLINK`) と異なる。git はこれをリンクと認識できず、Windows 側が未知の reparse point を透過的に辿るため、
  ディレクトリ走査がジャンクションの中へ入り込む
- 本物のシンボリックリンクなら git はモード `120000` (リンク先パス文字列だけの blob) として扱う。ただし、開発者モードの無い Windows で clone すると
  git は「リンク先パス文字列が書かれたただのテキストファイル」を生成し、リンクとして機能しない

## 回避策

**リンクの実体を Git 管理下に置かない。** 選択肢は 2 つ。

1. リンク先ディレクトリを `.gitignore` に入れ、clone 後にセットアップスクリプトで生成する。`ln -s` を試し、失敗したら `cmd.exe //c mklink //J` へ
   フォールバックする (ジャンクションは管理者権限不要、ディレクトリのみ)。既にあれば何もしない冪等な形にする
2. そもそもリンクをやめ、片方をもう片方からの**変換生成物**にして Git 管理下に置く
   ([generate-gemini-assets-from-claude-assets.md](generate-gemini-assets-from-claude-assets.md))。両 CLI のスキーマが違う時点で
   「同じ実体を両方から読ませる」前提が崩れているので、こちらが本筋

`rm -rf .gemini/docs` のようにジャンクション自体を消してもリンク先の実ファイルは巻き込まれない (使い捨てディレクトリで確認済み)。

## 再現条件

Windows 10、Git for Windows、開発者モード無効のセッション。`git status` が中身を列挙する挙動は実機で確認されている。

## 関連

- [.gemini/ を .claude/ からの変換生成物にして Git 管理下に置く](generate-gemini-assets-from-claude-assets.md)
- [ConfigChange と FileChanged に頼ったガードは他のエージェント CLI へ移植できない](../hook/hook-event-portability-across-agent-clis.md)。CLI 間で資産を共有するときの別の壁
