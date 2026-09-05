---
type: note
nature: finding
title: permissions の deny は ANY、allow は ALL で照合されると読める (未検証)
description: >-
  Note on the asymmetric semantics of Claude Code permission rules for compound Bash commands, now stated in
  the official permissions page: `deny` and `ask` apply when any sub-command matches (including subshells,
  `$()`, and loop bodies), `allow` auto-approves only if every sub-command matches. Records why a deny-side
  experiment alone (four cases passed) cannot show that a leading comment line is "ignored", and that the
  allow side is still unmeasured here. Use when deciding whether a comment or prose may precede a real command
  in a tool call, or when writing a hook `if` filter, whose matching table the hooks reference now documents.
  Not for hook matchers on the tool name, and not a measurement of the allow side.
tags: [claude-code, security]
keywords: [permissions.allow, permissions.deny, ANY, ALL, 複合コマンド, 部分コマンド, 先頭コメント, 前方一致, 部分一致, if フィルタ, Bash if matching, best-effort, 承認プロンプト, 公式に明文化]
status: stable
verified_at: 2026-09-05
sources:
  - https://code.claude.com/docs/en/permissions
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/settings
  - https://github.com/yuki-matsu783/MR-driven-workflow/tree/main/.claude/docs/ddr
stale_after: 2027-03-05
---

# permissions の deny は ANY、allow は ALL で照合される

複合コマンド (`a && b`、`a; b`) に対する permission rule の意味論は非対称。公式の permissions ページに明文化されている (2026-09 時点)。

| 規則 | 判定 |
|---|---|
| `permissions.deny` / `permissions.ask` | **いずれか**の部分コマンドが一致したら適用 (ANY)。サブシェル、`$()`、`for` の本体に入っているものも含む |
| `permissions.allow` | **すべて**の部分コマンドが一致して初めて自動承認 (ALL) |

区切りとして認識されるのは `&&` `||` `;` `|` `|&` `&` と改行。`&&` の後ろが空 (`npm test &&`) だと解析不能として分割せず、allow に一致しない。

この非対称のもとでは、複数行コマンドの先頭にコメント行があるとき、それが「無視される」のか「どの許可規則にも一致しない部分コマンドとして数えられる」のかを、
**deny の実験では原理的に区別できない** (後者でも deny の結果は変わらない)。元 issue が問題にしていたのは後者 (許可済みのはずの操作で承認プロンプトが出る) で、
deny 側の実測 4 ケースが「すり抜けなかった」ことは、その主張を反証しない。改行が区切りである以上、コメント行が部分コマンドとして数えられる可能性は残る。
公式はコメント行の扱いを書いていない。

## hook の `if` フィルタ

hooks リファレンスは `if` の照合を「Bash if matching」表として文書化した。permission rule と同じ構文で、先頭の `VAR=value` は剥がし、
部分コマンドごとに照合し、`$()` とバッククォートの中も見る。`$TOOL git push` のようにコマンド名が読めないときは hook を走らせる。
そのうえで **`if` は best-effort であり、確実な allow / deny には permission システムを使え**と明記している。

以前この調査で「`if` の挙動が別の時点の観測 (部分一致で発火する) と食い違う」と記録したが、当時は公式の記述が無かった。
現行の規則は「最初の `*` より前を書いたとおりに照合する」なので、`Bash(git commit *)` は `git -C /repo commit` に一致しない。
`if` をガードの前置フィルタにしない判断はこの規則から導ける ([ガードの判定はスクリプト 1 箇所に集め settings.json には入口だけを置く](../common/guard-config-lives-in-one-script.md))。

## 確かめていないこと

- allow 側の挙動。確かめるには権限モードをプロンプトが出る形へ変える必要があり、承認する人間が不在の環境ではあらゆるコマンドが承認待ちになって
  実験用の設定を削除するコマンドすら実行できず復旧できない。実験のために作業不能になるリスクは取らなかった
- 測定は Claude Code on the web (Linux)、2026-08-20 の 1 環境・1 バージョン。Windows / git bash では未確認

## 昇格の目安

- [ ] 粒度が type の定義に収まっている (concept / how-to / reference / pattern / pitfall)
- [x] sources に一次情報がある (permissions ページと hooks リファレンスに明文化された)
- [ ] 実際に試して applies_to を書ける (allow 側を、人間が承認できる対話セッションで測る)

## 関連

- [Bash ツールの description はコンソールに 1 行しか表示されない](../../workflow/tool-description-shows-one-line.md)
- [権限は permissions.deny ではなく PreToolUse hook で止める](../20-PreToolUse/deny-by-hook-not-permissions.md)
