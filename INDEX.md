---
type: index
title: 知識インデックス
description: frontmatter から自動生成した全 markdown の一覧
tags: [meta]
keywords: [index, 一覧, frontmatter, 自動生成]
---

# 知識インデックス

生成物。手で編集しない。`pnpm index` で再生成する。

## knowledge

| ID | title | type | status | tags | verified_at |
|---|---|---|---|---|---|
| [knowledge/ask-user-to-reset-context-at-task-boundaries](knowledge/ask-user-to-reset-context-at-task-boundaries.md) | タスクの切れ目で /compact と /clear をユーザに依頼させる | pattern | verified | claude-code, context-management, workflow | 2026-09-05 |
| [knowledge/command-wrappers-instead-of-raw-bash](knowledge/command-wrappers-instead-of-raw-bash.md) | 生のコマンド実行を deny してラッパスクリプトへ誘導する | pattern | verified | claude-code, context-management, security, observability | 2026-09-05 |
| [knowledge/deny-by-hook-not-permissions](knowledge/deny-by-hook-not-permissions.md) | 権限は permissions.deny ではなく PreToolUse hook で止める | pattern | verified | claude-code, security, workflow | 2026-09-05 |
| [knowledge/gemini-cli-no-post-compress-hook](knowledge/gemini-cli-no-post-compress-hook.md) | Gemini CLI には圧縮後に発火する hook が無い | pitfall | verified | gemini-cli, claude-code, context-management | 2026-09-05 |
| [knowledge/guard-hook-enforcement-modes](knowledge/guard-hook-enforcement-modes.md) | ガード hook は enforce / dry-run / off の 3 モードで運用する | pattern | verified | claude-code, security, observability | 2026-09-05 |
| [knowledge/hook-event-portability-across-agent-clis](knowledge/hook-event-portability-across-agent-clis.md) | ConfigChange と FileChanged に頼ったガードは他のエージェント CLI へ移植できない | pitfall | verified | claude-code, security, workflow | 2026-09-05 |
| [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md) | タイムアウトした hook はガードにならず素通りする | pitfall | verified | claude-code, security, workflow | 2026-09-05 |
| [knowledge/injecting-vs-guarding-hooks](knowledge/injecting-vs-guarding-hooks.md) | hook を注入系とガード系に分け、失敗時の既定を逆にする | pattern | verified | claude-code, security, workflow | 2026-09-05 |
| [knowledge/protect-guard-config-from-the-agent](knowledge/protect-guard-config-from-the-agent.md) | ガードの設定と hook スクリプト自身をエージェントから守る | pattern | verified | claude-code, security, workflow | 2026-09-05 |
| [knowledge/protected-file-rewritten-via-subprocess](knowledge/protected-file-rewritten-via-subprocess.md) | Edit/Write を deny してもスクリプト経由でファイルは書き換わる | pitfall | verified | claude-code, security, observability | 2026-09-05 |
| [knowledge/regex-command-match-misfires](knowledge/regex-command-match-misfires.md) | 生の文字列でコマンドを判定すると引用符とコメントに誤爆する | pitfall | verified | claude-code, security, workflow | 2026-09-05 |

## inbox

| ID | title | type | status | tags | verified_at |
|---|---|---|---|---|---|
| [inbox/archify-verified-architecture-diagrams](inbox/archify-verified-architecture-diagrams.md) | archify で検証付きの構成図を生成する | note | outdated | workflow, meta, claude-code | 2026-09-05 |
| [inbox/context-free-audit-subagent-on-tool-count](inbox/context-free-audit-subagent-on-tool-count.md) | ツール使用回数を閾値にして、文脈を持たない監査サブエージェントを背景で走らせる | note | draft | claude-code, multi-agent, workflow |  |
| [inbox/excel-export-from-markdown-csv](inbox/excel-export-from-markdown-csv.md) | markdown / CSV から Excel (xlsx) を書き出す手段 | note | outdated | workflow, meta | 2026-09-05 |
| [inbox/marpx-editable-pptx-from-marp](inbox/marpx-editable-pptx-from-marp.md) | marpx で Marp から編集可能な PPTX を作る | note | draft | workflow, meta |  |
| [inbox/observability-layer-for-claude-code](inbox/observability-layer-for-claude-code.md) | Claude Code の実行を観測する層を後付けで入れる | note | draft | claude-code, observability, cost, security |  |
| [inbox/subagent-progress-ui-in-vscode](inbox/subagent-progress-ui-in-vscode.md) | サブエージェントと全体進捗を VS Code 拡張で可視化しながら実行する | note | draft | claude-code, multi-agent, observability |  |

## adr

| ID | title | type | status | tags | verified_at |
|---|---|---|---|---|---|
| [adr/0001-repository-conventions](adr/0001-repository-conventions.md) | リポジトリ規約の初期決定 | adr | verified | meta, workflow | 2026-09-05 |
| [adr/0002-wip-directory-for-session-local-files](adr/0002-wip-directory-for-session-local-files.md) | セッション中の作業ファイルは wip/ に置き、コミットするものとしないものを分ける | adr | verified | meta, workflow | 2026-09-05 |

## slides

| ID | title | type | status | tags | verified_at |
|---|---|---|---|---|---|
| [slides/marp-html-slides-from-markdown](slides/marp-html-slides-from-markdown.md) | Marp CLI で markdown から HTML スライドを生成する | slide | verified | workflow, meta | 2026-09-05 |

## タグ別

- **claude-code**: [inbox/archify-verified-architecture-diagrams](inbox/archify-verified-architecture-diagrams.md), [inbox/context-free-audit-subagent-on-tool-count](inbox/context-free-audit-subagent-on-tool-count.md), [inbox/observability-layer-for-claude-code](inbox/observability-layer-for-claude-code.md), [inbox/subagent-progress-ui-in-vscode](inbox/subagent-progress-ui-in-vscode.md), [knowledge/ask-user-to-reset-context-at-task-boundaries](knowledge/ask-user-to-reset-context-at-task-boundaries.md), [knowledge/command-wrappers-instead-of-raw-bash](knowledge/command-wrappers-instead-of-raw-bash.md), [knowledge/deny-by-hook-not-permissions](knowledge/deny-by-hook-not-permissions.md), [knowledge/gemini-cli-no-post-compress-hook](knowledge/gemini-cli-no-post-compress-hook.md), [knowledge/guard-hook-enforcement-modes](knowledge/guard-hook-enforcement-modes.md), [knowledge/hook-event-portability-across-agent-clis](knowledge/hook-event-portability-across-agent-clis.md), [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md), [knowledge/injecting-vs-guarding-hooks](knowledge/injecting-vs-guarding-hooks.md), [knowledge/protect-guard-config-from-the-agent](knowledge/protect-guard-config-from-the-agent.md), [knowledge/protected-file-rewritten-via-subprocess](knowledge/protected-file-rewritten-via-subprocess.md), [knowledge/regex-command-match-misfires](knowledge/regex-command-match-misfires.md)
- **context-management**: [knowledge/ask-user-to-reset-context-at-task-boundaries](knowledge/ask-user-to-reset-context-at-task-boundaries.md), [knowledge/command-wrappers-instead-of-raw-bash](knowledge/command-wrappers-instead-of-raw-bash.md), [knowledge/gemini-cli-no-post-compress-hook](knowledge/gemini-cli-no-post-compress-hook.md)
- **cost**: [inbox/observability-layer-for-claude-code](inbox/observability-layer-for-claude-code.md)
- **gemini-cli**: [knowledge/gemini-cli-no-post-compress-hook](knowledge/gemini-cli-no-post-compress-hook.md)
- **meta**: [adr/0001-repository-conventions](adr/0001-repository-conventions.md), [adr/0002-wip-directory-for-session-local-files](adr/0002-wip-directory-for-session-local-files.md), [inbox/archify-verified-architecture-diagrams](inbox/archify-verified-architecture-diagrams.md), [inbox/excel-export-from-markdown-csv](inbox/excel-export-from-markdown-csv.md), [inbox/marpx-editable-pptx-from-marp](inbox/marpx-editable-pptx-from-marp.md), [slides/marp-html-slides-from-markdown](slides/marp-html-slides-from-markdown.md)
- **multi-agent**: [inbox/context-free-audit-subagent-on-tool-count](inbox/context-free-audit-subagent-on-tool-count.md), [inbox/subagent-progress-ui-in-vscode](inbox/subagent-progress-ui-in-vscode.md)
- **observability**: [inbox/observability-layer-for-claude-code](inbox/observability-layer-for-claude-code.md), [inbox/subagent-progress-ui-in-vscode](inbox/subagent-progress-ui-in-vscode.md), [knowledge/command-wrappers-instead-of-raw-bash](knowledge/command-wrappers-instead-of-raw-bash.md), [knowledge/guard-hook-enforcement-modes](knowledge/guard-hook-enforcement-modes.md), [knowledge/protected-file-rewritten-via-subprocess](knowledge/protected-file-rewritten-via-subprocess.md)
- **security**: [inbox/observability-layer-for-claude-code](inbox/observability-layer-for-claude-code.md), [knowledge/command-wrappers-instead-of-raw-bash](knowledge/command-wrappers-instead-of-raw-bash.md), [knowledge/deny-by-hook-not-permissions](knowledge/deny-by-hook-not-permissions.md), [knowledge/guard-hook-enforcement-modes](knowledge/guard-hook-enforcement-modes.md), [knowledge/hook-event-portability-across-agent-clis](knowledge/hook-event-portability-across-agent-clis.md), [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md), [knowledge/injecting-vs-guarding-hooks](knowledge/injecting-vs-guarding-hooks.md), [knowledge/protect-guard-config-from-the-agent](knowledge/protect-guard-config-from-the-agent.md), [knowledge/protected-file-rewritten-via-subprocess](knowledge/protected-file-rewritten-via-subprocess.md), [knowledge/regex-command-match-misfires](knowledge/regex-command-match-misfires.md)
- **workflow**: [adr/0001-repository-conventions](adr/0001-repository-conventions.md), [adr/0002-wip-directory-for-session-local-files](adr/0002-wip-directory-for-session-local-files.md), [inbox/archify-verified-architecture-diagrams](inbox/archify-verified-architecture-diagrams.md), [inbox/context-free-audit-subagent-on-tool-count](inbox/context-free-audit-subagent-on-tool-count.md), [inbox/excel-export-from-markdown-csv](inbox/excel-export-from-markdown-csv.md), [inbox/marpx-editable-pptx-from-marp](inbox/marpx-editable-pptx-from-marp.md), [knowledge/ask-user-to-reset-context-at-task-boundaries](knowledge/ask-user-to-reset-context-at-task-boundaries.md), [knowledge/deny-by-hook-not-permissions](knowledge/deny-by-hook-not-permissions.md), [knowledge/hook-event-portability-across-agent-clis](knowledge/hook-event-portability-across-agent-clis.md), [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md), [knowledge/injecting-vs-guarding-hooks](knowledge/injecting-vs-guarding-hooks.md), [knowledge/protect-guard-config-from-the-agent](knowledge/protect-guard-config-from-the-agent.md), [knowledge/regex-command-match-misfires](knowledge/regex-command-match-misfires.md), [slides/marp-html-slides-from-markdown](slides/marp-html-slides-from-markdown.md)

## 無効化された知識

| 旧 | 無効化した側 |
|---|---|
| [inbox/archify-verified-architecture-diagrams](inbox/archify-verified-architecture-diagrams.md) | [.claude/docs/10_spec/archify-diagrams](.claude/docs/10_spec/archify-diagrams.md) |
| [inbox/excel-export-from-markdown-csv](inbox/excel-export-from-markdown-csv.md) | [.claude/docs/10_spec/xlsx-export](.claude/docs/10_spec/xlsx-export.md) |
