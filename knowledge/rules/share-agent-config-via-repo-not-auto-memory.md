---
type: pattern
nature: principle
title: 共同開発のエージェント設定は auto memory ではなく clone で揃う場所に置くべき
description: >-
  A principle for teams sharing one repository with Claude Code: treat the machine-local auto memory
  (~/.claude/projects/<project>/memory/) as a source of per-developer behavioral drift, disable it with
  autoMemoryEnabled:false in the committed .claude/settings.json, and move anything worth keeping into
  CLAUDE.md, .claude/rules/, skills, and hooks so that git clone plus opening the VS Code extension gives
  every developer the same agent. Use when two people get different agent behavior on the same repo, or
  when deciding where a "remember this" request should land. Not for solo work on one machine, and not a
  claim that CLAUDE.md is enforced (it is context; use hooks and permissions for guarantees).
tags: [claude-code, workflow, context-management]
keywords: [auto memory, autoMemoryEnabled, MEMORY.md, 共同開発, 標準化, 差分, 再現性, git clone, VS Code 拡張, CLAUDE.md, .claude/rules, settings.json, settings.local.json, CLAUDE.local.md, machine-local, worktree, Claude Code on the web, 属人化, 覚えて]
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/settings
intervention: hook
---

# 共同開発のエージェント設定は auto memory ではなく clone で揃う場所に置くべき

## 課題

Claude Code の auto memory は、エージェントが自分で書き溜める記録で、既定で有効になっている。
保存先は `~/.claude/projects/<project>/memory/` で、公式文書はこれを machine-local と明記している。
同じリポジトリの worktree 同士では共有されるが、他の開発者のマシンや Claude Code on the web には渡らない。

1 人で使っている間はこれで困らない。複数人で同じリポジトリを開発すると、次のことが起きる。

- A のマシンでは「pnpm を使う」「description は英語で書く」が memory に載っていて守られ、B のマシンでは守られない。同じ CLAUDE.md を読んでいるのに動作が違う
- 差分の原因が memory にあることは、本人の `~/.claude/` を見ないと分からない。リポジトリの diff にも transcript にも出ない
- 「覚えて」と言った内容が memory に吸われるので、本来 CLAUDE.md や rules に書くべき決定がリポジトリに残らない
- 同じ人でも、マシンを変えると (社用 PC と Claude Code on the web など) エージェントが別人になる

## 解決

「git clone して VS Code 拡張で Claude Code を開いたら、誰でも同じ状態のエージェントが使える」を目標にし、機械が読む設定を全部リポジトリ側に寄せる。

1. **auto memory をプロジェクト単位で切る。** コミットする `.claude/settings.json` に書く。公式文書がプロジェクト設定でのこの指定を認めている。

   ```json
   { "autoMemoryEnabled": false }
   ```

   個人の `~/.claude/settings.json` の toggle (`/memory` から切り替える) では他の人に効かないので、リポジトリ側で切る
2. **既存の memory を棚卸しして移す。** `~/.claude/projects/<project>/memory/` の各ファイルを読み、次の表で行き先を決める。移し終えたら memory 側は消す

   | memory の中身 | 行き先 |
   |---|---|
   | 常に守る規約 (道具の選択、言語、口調) | CLAUDE.md か `.claude/rules/` |
   | 特定のファイルにだけ効く書き方 | `.claude/rules/` の `paths` 付き rule |
   | 手順 | `.claude/skills/` |
   | 確実に止めたいこと | `.claude/settings.json` の permissions か hook |
   | 他のリポジトリでも通用する知見 | knowledge (このリポジトリなら `knowledge/`) |
   | 個人の好み (エディタ、URL、テストデータ) | `CLAUDE.local.md` か `.claude/settings.local.json` (gitignore) |

3. **「覚えて」の受け口を決めておく。** CLAUDE.md に「記憶は memory ではなく rules か knowledge に書く」と書いておくと、エージェントが memory に逃がさず、リポジトリへの変更として提案してくる

## 適用条件

- 効く: 同じリポジトリを 2 人以上で触る、同じ人が複数マシンや Claude Code on the web を使う、エージェントの動作を PR でレビューしたい
- 効かない: 1 人 1 マシンで、個人の好みをエージェントに学ばせたい場合。このときは memory の方が手軽
- 前提: 共有したい設定が全部リポジトリに入っていること。`.claude/settings.local.json`、`CLAUDE.local.md`、`~/.claude/CLAUDE.md`、`~/.claude/rules/` は個人用で clone に含まれないので、そこに共有すべき設定が漏れていないかも合わせて見る

## トレードオフ

- 得るもの: 動作の差分が全部 git の diff に出る。新しい人が clone だけで同じエージェントを使える。「なぜこう動くのか」を `~/.claude/` を見ずに答えられる
- 失うもの: エージェントが自分で学習して直ってくれる手軽さ。修正はすべて人が rules に書く (か、エージェントに rules への追記を提案させる) 作業になる
- 「clone だけ」は厳密には成立しない。hook が `node --import tsx` や `.venv` に依存するなら `pnpm install` と `uv sync` が要る。この 2 コマンドで揃う状態を保つのが現実的な線 (このリポジトリの [scripting.md](../../.claude/rules/scripting.md) はそう定めている)
- CLAUDE.md と rules はコンテキストであって強制ではない。差分を無くす目的でも、破られると困る項目は hook と permissions に置く

## 確かめたこと

- Claude Code 2.1 の VS Code 拡張で、auto memory が `~/.claude/projects/<project>/memory/` に `MEMORY.md` と項目ごとの markdown として書かれることを手元で確認した
- machine-local であること、worktree 間で共有されること、`autoMemoryEnabled` をプロジェクト設定に書けること、環境変数 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` でも切れることは公式文書 (sources) の記述。プロジェクト設定で切ったあとの挙動はまだ実測していない

## 関連

- [rules を固定フォーマットの唯一の正にし、レビューは関心事ごとのサブエージェントが横断的に読むとよいはず](rules-as-single-source-for-authoring-and-review.md)。memory から移した先を rules 1 層に保つ設計
- [抜けを塞ぐのはルールの文言強化ではなく記録とゲートであるべき](close-gaps-with-mechanism-not-wording.md)。破られると困る項目を rules ではなく機構に置く理由
- [生成物を Git 管理下に置くかは人間が直接読むかで決めた方がよさそう](../workflow/committed-vs-ignored-generated-files.md)。clone 直後に存在すべきものをコミットする判断
