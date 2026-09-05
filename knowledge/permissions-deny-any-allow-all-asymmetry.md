---
type: note
title: permissions の deny は ANY、allow は ALL で照合される
description: >-
  Unverified note on the asymmetric semantics of Claude Code permission rules for compound Bash commands:
  `deny` rejects if any sub-command matches, `allow` auto-approves only if every sub-command matches, which
  means a leading comment line cannot be shown to be "ignored" by a deny experiment alone (four cases passed),
  while the allow side was never measured because switching to a prompting mode would have frozen the
  unattended session. Use when deciding whether a comment or prose may precede a real command in a tool
  call, or when reading conflicting reports about prefix vs substring matching of `if` filters. Not a
  statement of current behaviour, which varies by environment and version, and not for hook matchers.
tags: [claude-code, security]
keywords: [permissions.allow, permissions.deny, ANY, ALL, 複合コマンド, 部分コマンド, 先頭コメント, 前方一致, 部分一致, if フィルタ, 未確認, 環境依存, 承認プロンプト]
status: stable
sources:
  - https://code.claude.com/docs/en/settings
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
---

# permissions の deny は ANY、allow は ALL で照合される

複合コマンド (`a && b`、`a; b`) に対する permission rule の意味論は非対称。

| 規則 | 判定 |
|---|---|
| `permissions.deny` | **いずれか**の部分コマンドが一致したら拒否 (ANY) |
| `permissions.allow` | **すべて**の部分コマンドが一致して初めて自動承認 (ALL) |

この非対称のもとでは、複数行コマンドの先頭にコメント行があるとき、それが「無視される」のか「どの許可規則にも一致しない部分コマンドとして数えられる」のかを、
**deny の実験では原理的に区別できない** (後者でも deny の結果は変わらない)。元 issue が問題にしていたのは後者 (許可済みのはずの操作で承認プロンプトが出る) で、
deny 側の実測 4 ケースが「すり抜けなかった」ことは、その主張を反証しない。

同じ調査で、hook の `if` フィルタの挙動が、別の時点で Windows / git bash で記録された観測 (部分一致で発火する) と食い違った。
どちらが現行かを決める材料は無く、**照合の実装は環境やバージョンで変わりうる**という一段抽象度の高い事実だけが残った。
この不確実性が、ルールを「前方一致が外れる」と断定せず「先頭は避ける」というリスク回避として書く根拠になっている。
根拠が事実でないルールは、次に読んだ人が実測して食い違いに気づいた時点でルール全体の信頼を落とす。

## 確かめていないこと

- allow 側の挙動。確かめるには権限モードをプロンプトが出る形へ変える必要があり、承認する人間が不在の環境ではあらゆるコマンドが承認待ちになって
  実験用の設定を削除するコマンドすら実行できず復旧できない。実験のために作業不能になるリスクは取らなかった
- 測定は Claude Code on the web (Linux)、2026-08-20 の 1 環境・1 バージョン。Windows / git bash では未確認

## 昇格の目安

- [ ] 粒度が type の定義に収まっている (concept / how-to / reference / pattern / pitfall)
- [ ] sources に一次情報がある
- [ ] 実際に試して applies_to と verified_at を書ける (allow 側を、人間が承認できる対話セッションで測る)

## 関連

- [Bash ツールの description はコンソールに 1 行しか表示されない](tool-description-shows-one-line.md)
- [権限は permissions.deny ではなく PreToolUse hook で止める](deny-by-hook-not-permissions.md)
