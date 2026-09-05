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
| [knowledge/ask-user-to-reset-context-at-task-boundaries](knowledge/ask-user-to-reset-context-at-task-boundaries.md) | タスクの切れ目で /compact と /clear をユーザに依頼させる | pattern | stable | claude-code, context-management, workflow | 2026-09-05 |
| [knowledge/command-wrappers-instead-of-raw-bash](knowledge/command-wrappers-instead-of-raw-bash.md) | 生のコマンド実行を deny してラッパスクリプトへ誘導する | pattern | stable | claude-code, context-management, security, observability | 2026-09-05 |
| [knowledge/context-free-audit-subagent-on-tool-count](knowledge/context-free-audit-subagent-on-tool-count.md) | ツール使用回数を閾値にして、文脈を持たない監査サブエージェントを背景で走らせる | note | stable | claude-code, multi-agent, workflow |  |
| [knowledge/decision-log-beside-design-docs](knowledge/decision-log-beside-design-docs.md) | 設計書の隣に決定ログを置く | note | stable | workflow, context-management |  |
| [knowledge/deny-by-hook-not-permissions](knowledge/deny-by-hook-not-permissions.md) | 権限は permissions.deny ではなく PreToolUse hook で止める | pattern | stable | claude-code, security, workflow | 2026-09-05 |
| [knowledge/gemini-cli-no-post-compress-hook](knowledge/gemini-cli-no-post-compress-hook.md) | Gemini CLI には圧縮後に発火する hook が無い | pitfall | stable | gemini-cli, claude-code, context-management | 2026-09-05 |
| [knowledge/guard-hook-enforcement-modes](knowledge/guard-hook-enforcement-modes.md) | ガード hook は enforce / dry-run / off の 3 モードで運用する | pattern | stable | claude-code, security, observability | 2026-09-05 |
| [knowledge/hook-event-portability-across-agent-clis](knowledge/hook-event-portability-across-agent-clis.md) | ConfigChange と FileChanged に頼ったガードは他のエージェント CLI へ移植できない | pitfall | stable | claude-code, security, workflow | 2026-09-05 |
| [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md) | タイムアウトした hook はガードにならず素通りする | pitfall | stable | claude-code, security, workflow | 2026-09-05 |
| [knowledge/injecting-vs-guarding-hooks](knowledge/injecting-vs-guarding-hooks.md) | hook を注入系とガード系に分け、失敗時の既定を逆にする | pattern | stable | claude-code, security, workflow | 2026-09-05 |
| [knowledge/marpx-editable-pptx-from-marp](knowledge/marpx-editable-pptx-from-marp.md) | marpx で Marp から編集可能な PPTX を作る | note | stable | workflow, meta |  |
| [knowledge/observability-layer-for-claude-code](knowledge/observability-layer-for-claude-code.md) | Claude Code の実行を観測する層を後付けで入れる | note | stable | claude-code, observability, cost, security |  |
| [knowledge/protect-guard-config-from-the-agent](knowledge/protect-guard-config-from-the-agent.md) | ガードの設定と hook スクリプト自身をエージェントから守る | pattern | stable | claude-code, security, workflow | 2026-09-05 |
| [knowledge/protected-file-rewritten-via-subprocess](knowledge/protected-file-rewritten-via-subprocess.md) | Edit/Write を deny してもスクリプト経由でファイルは書き換わる | pitfall | stable | claude-code, security, observability | 2026-09-05 |
| [knowledge/regex-command-match-misfires](knowledge/regex-command-match-misfires.md) | 生の文字列でコマンドを判定すると引用符とコメントに誤爆する | pitfall | stable | claude-code, security, workflow | 2026-09-05 |
| [knowledge/subagent-model-selection-by-orchestrator](knowledge/subagent-model-selection-by-orchestrator.md) | サブエージェントのモデルは定義で固定せず呼び出し側に決めさせる | pattern | stable | claude-code, multi-agent, cost | 2026-09-05 |
| [knowledge/subagent-progress-ui-in-vscode](knowledge/subagent-progress-ui-in-vscode.md) | サブエージェントと全体進捗を VS Code 拡張で可視化しながら実行する | note | stable | claude-code, multi-agent, observability |  |

## adr

| ID | title | type | status | tags | verified_at |
|---|---|---|---|---|---|
| [adr/0001-repository-conventions](adr/0001-repository-conventions.md) | リポジトリ規約の初期決定 | adr | stable | meta, workflow | 2026-09-05 |
| [adr/0002-wip-directory-for-session-local-files](adr/0002-wip-directory-for-session-local-files.md) | セッション中の作業ファイルは wip/ に置き、コミットするものとしないものを分ける | adr | stable | meta, workflow | 2026-09-05 |
| [adr/0003-flatten-inbox-and-two-value-status](adr/0003-flatten-inbox-and-two-value-status.md) | inbox/ を廃止し status を stable / deprecated の 2 値にする | adr | stable | meta, workflow | 2026-09-05 |

## slides

| ID | title | type | status | tags | verified_at |
|---|---|---|---|---|---|
| [slides/marp-html-slides-from-markdown](slides/marp-html-slides-from-markdown.md) | Marp CLI で markdown から HTML スライドを生成する | slide | stable | workflow, meta | 2026-09-05 |

## タグ別

- **claude-code**: [knowledge/ask-user-to-reset-context-at-task-boundaries](knowledge/ask-user-to-reset-context-at-task-boundaries.md), [knowledge/command-wrappers-instead-of-raw-bash](knowledge/command-wrappers-instead-of-raw-bash.md), [knowledge/context-free-audit-subagent-on-tool-count](knowledge/context-free-audit-subagent-on-tool-count.md), [knowledge/deny-by-hook-not-permissions](knowledge/deny-by-hook-not-permissions.md), [knowledge/gemini-cli-no-post-compress-hook](knowledge/gemini-cli-no-post-compress-hook.md), [knowledge/guard-hook-enforcement-modes](knowledge/guard-hook-enforcement-modes.md), [knowledge/hook-event-portability-across-agent-clis](knowledge/hook-event-portability-across-agent-clis.md), [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md), [knowledge/injecting-vs-guarding-hooks](knowledge/injecting-vs-guarding-hooks.md), [knowledge/observability-layer-for-claude-code](knowledge/observability-layer-for-claude-code.md), [knowledge/protect-guard-config-from-the-agent](knowledge/protect-guard-config-from-the-agent.md), [knowledge/protected-file-rewritten-via-subprocess](knowledge/protected-file-rewritten-via-subprocess.md), [knowledge/regex-command-match-misfires](knowledge/regex-command-match-misfires.md), [knowledge/subagent-model-selection-by-orchestrator](knowledge/subagent-model-selection-by-orchestrator.md), [knowledge/subagent-progress-ui-in-vscode](knowledge/subagent-progress-ui-in-vscode.md)
- **context-management**: [knowledge/ask-user-to-reset-context-at-task-boundaries](knowledge/ask-user-to-reset-context-at-task-boundaries.md), [knowledge/command-wrappers-instead-of-raw-bash](knowledge/command-wrappers-instead-of-raw-bash.md), [knowledge/decision-log-beside-design-docs](knowledge/decision-log-beside-design-docs.md), [knowledge/gemini-cli-no-post-compress-hook](knowledge/gemini-cli-no-post-compress-hook.md)
- **cost**: [knowledge/observability-layer-for-claude-code](knowledge/observability-layer-for-claude-code.md), [knowledge/subagent-model-selection-by-orchestrator](knowledge/subagent-model-selection-by-orchestrator.md)
- **gemini-cli**: [knowledge/gemini-cli-no-post-compress-hook](knowledge/gemini-cli-no-post-compress-hook.md)
- **meta**: [adr/0001-repository-conventions](adr/0001-repository-conventions.md), [adr/0002-wip-directory-for-session-local-files](adr/0002-wip-directory-for-session-local-files.md), [adr/0003-flatten-inbox-and-two-value-status](adr/0003-flatten-inbox-and-two-value-status.md), [knowledge/marpx-editable-pptx-from-marp](knowledge/marpx-editable-pptx-from-marp.md), [slides/marp-html-slides-from-markdown](slides/marp-html-slides-from-markdown.md)
- **multi-agent**: [knowledge/context-free-audit-subagent-on-tool-count](knowledge/context-free-audit-subagent-on-tool-count.md), [knowledge/subagent-model-selection-by-orchestrator](knowledge/subagent-model-selection-by-orchestrator.md), [knowledge/subagent-progress-ui-in-vscode](knowledge/subagent-progress-ui-in-vscode.md)
- **observability**: [knowledge/command-wrappers-instead-of-raw-bash](knowledge/command-wrappers-instead-of-raw-bash.md), [knowledge/guard-hook-enforcement-modes](knowledge/guard-hook-enforcement-modes.md), [knowledge/observability-layer-for-claude-code](knowledge/observability-layer-for-claude-code.md), [knowledge/protected-file-rewritten-via-subprocess](knowledge/protected-file-rewritten-via-subprocess.md), [knowledge/subagent-progress-ui-in-vscode](knowledge/subagent-progress-ui-in-vscode.md)
- **security**: [knowledge/command-wrappers-instead-of-raw-bash](knowledge/command-wrappers-instead-of-raw-bash.md), [knowledge/deny-by-hook-not-permissions](knowledge/deny-by-hook-not-permissions.md), [knowledge/guard-hook-enforcement-modes](knowledge/guard-hook-enforcement-modes.md), [knowledge/hook-event-portability-across-agent-clis](knowledge/hook-event-portability-across-agent-clis.md), [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md), [knowledge/injecting-vs-guarding-hooks](knowledge/injecting-vs-guarding-hooks.md), [knowledge/observability-layer-for-claude-code](knowledge/observability-layer-for-claude-code.md), [knowledge/protect-guard-config-from-the-agent](knowledge/protect-guard-config-from-the-agent.md), [knowledge/protected-file-rewritten-via-subprocess](knowledge/protected-file-rewritten-via-subprocess.md), [knowledge/regex-command-match-misfires](knowledge/regex-command-match-misfires.md)
- **workflow**: [adr/0001-repository-conventions](adr/0001-repository-conventions.md), [adr/0002-wip-directory-for-session-local-files](adr/0002-wip-directory-for-session-local-files.md), [adr/0003-flatten-inbox-and-two-value-status](adr/0003-flatten-inbox-and-two-value-status.md), [knowledge/ask-user-to-reset-context-at-task-boundaries](knowledge/ask-user-to-reset-context-at-task-boundaries.md), [knowledge/context-free-audit-subagent-on-tool-count](knowledge/context-free-audit-subagent-on-tool-count.md), [knowledge/decision-log-beside-design-docs](knowledge/decision-log-beside-design-docs.md), [knowledge/deny-by-hook-not-permissions](knowledge/deny-by-hook-not-permissions.md), [knowledge/hook-event-portability-across-agent-clis](knowledge/hook-event-portability-across-agent-clis.md), [knowledge/hook-timeout-fails-open](knowledge/hook-timeout-fails-open.md), [knowledge/injecting-vs-guarding-hooks](knowledge/injecting-vs-guarding-hooks.md), [knowledge/marpx-editable-pptx-from-marp](knowledge/marpx-editable-pptx-from-marp.md), [knowledge/protect-guard-config-from-the-agent](knowledge/protect-guard-config-from-the-agent.md), [knowledge/regex-command-match-misfires](knowledge/regex-command-match-misfires.md), [slides/marp-html-slides-from-markdown](slides/marp-html-slides-from-markdown.md)
