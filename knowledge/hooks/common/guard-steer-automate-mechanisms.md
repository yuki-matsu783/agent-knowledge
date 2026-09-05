---
type: concept
nature: principle
title: エージェントへの介入はガード・誘導・自動化の 3 機構で切るべき
description: >-
  Defines three purpose-level categories for anything that acts on a Claude Code agent from outside the
  conversation, named by what the agent can do afterwards: guard (it cannot proceed: deny / ask hooks,
  permissions, sandbox, script gates), steer (it reads text it may ignore: CLAUDE.md, rules, skills,
  additionalContext hooks, error messages), and automate (it sees nothing: formatters, logs, index
  regeneration, git hooks). Each category is a hook kind plus non-hook means, so "mechanism" is never used
  alone. Use when naming a hook, deciding which of the three a new script belongs to, or reading knowledge
  that says "guard hook" / "steer hook". Not the means axis (frontmatter intervention: prompt / tool /
  hook / human), and not the failure-default rule, which injecting-vs-guarding-hooks covers.
tags: [claude-code, workflow]
keywords: [ガード機構, 誘導機構, 自動化機構, ガード hook, 誘導 hook, 自動化 hook, 注入系, 機構, 語彙, guardrail, enforcement, permissions, sandbox, additionalContext, CLAUDE.md, rules, paths, ゲート, 提供コマンド, intervention]
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/features-overview
  - https://code.claude.com/docs/en/hooks-guide
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/security-guidance
  - https://code.claude.com/docs/en/memory
---

# エージェントへの介入はガード・誘導・自動化の 3 機構で切る

## 要点

エージェントの外から作用するものを「何をしたいか」で 3 つに分ける。**ガード** (止める)、**誘導** (促す)、**自動化** (代行する)。
判定は「その後エージェントが何をできるか」で行う。ガードは先へ進めない、誘導は読めるが無視できる、自動化は何も見えない。
3 つはそれぞれ hook の 1 種類と hook 以外の手段で実現されるので、「機構」は単独で使わず、必ずこの 3 語のどれかに実現手段を添えて言う。

## 仕組み

### 判定基準

| 機構 | エージェントから見た効き方 | 落ちたときの既定 |
|---|---|---|
| ガード | 先へ進めない。deny で止まるか、ask で人の判断待ちになる | 判定できなければ止める (exit 2) |
| 誘導 | 文を読める。従うかどうかはエージェント次第 | 何も足さずに通す (exit 0) |
| 自動化 | 何も見えない。副作用だけが起きる | 何もせずに通す (exit 0) |

落ちたときの既定は [hook は注入系とガード系に分かれ失敗時の既定は逆であるべき](injecting-vs-guarding-hooks.md) の分け方と一致する。
あちらの「注入系」は誘導と自動化を合わせたもので、失敗時の扱いは同じ側に落ちる。

### 目的と手段

Claude Code 2.1 (VS Code 拡張) で確かめた範囲。

| 機構 | hook での実現 | hook 以外の実現 |
|---|---|---|
| **ガード** | `PreToolUse` の `permissionDecision` を deny か ask にする、`PermissionRequest` の deny、`Stop` / `SubagentStop` の exit 2 (完了させない) | settings.json の `permissions` (allow / ask / deny、permission mode、managed settings)、sandbox、ツールの持たせ方 (サブエージェントの `tools` 制限、skill の `disable-model-invocation`)、スクリプト側のゲート (提供コマンドが条件未達で拒否する)、git の pre-commit とブランチ保護 |
| **誘導** | `hookSpecificOutput.additionalContext`、`UserPromptSubmit` / `SessionStart` の stdout、`PostToolUse` の exit 2 と stderr (ツールは既に走っているので止まらず、差し戻しになる) | CLAUDE.md、`.claude/rules/` (`paths` frontmatter が無ければ常時、あれば該当ファイルを触ったとき)、skill の description と本文、memory、MCP のツール説明と server instructions、スクリプトのエラーメッセージ (代替経路を名指しする) |
| **自動化** | `PostToolUse` の formatter と lint、`Stop` の通知、`SessionStart` の index 再生成、ログ記録、`systemMessage` による人への通知 | `.githooks/pre-commit` の自動ステージ、pnpm scripts、CI、`/loop` や `/schedule` の定期実行 |

### 分類の細則

- **hook 1 本が deny の経路と additionalContext の経路を両方持つなら、ガード hook に入れる。** 止める経路がある時点で失敗時の既定は fail-closed でなければならない。両方の役目を持つ hook は分割した方がよい (injecting-vs-guarding-hooks の「1 本の hook が両方の役目を持ったら分割する」)
- **ask はガード側。** 人の承認が出るまでエージェントは進めない。ヘッドレスでは ask が deny に化ける
- **`permissions` の allow も、ガード機構に丸ごと入れる。** allow は「通す側」だが、同じアクセス制御の一部で、deny や ask と切り離しては読めない
- **誘導は届くタイミングでもう 1 段分かれる。** 常時 (CLAUDE.md、`paths` の無い rules)、呼ばれたとき (skill、`paths` の付いた rules、memory)、契機 (hook の注入)。
  「記載を増やすだけでは流れで進む瞬間に効きにくいが、その瞬間に一度だけ注入するのは効く」([ガード hook にするか誘導 hook にするかは特定可能性と代替経路で決める](../20-PreToolUse/block-vs-notice-hook-selection.md)) はこの段の差
- **`systemMessage` は人に見せる文で、エージェントには届かない。** エージェントに読ませたいなら additionalContext を使う。人への通知は自動化側に置く
- **hook でないゲートはガード機構の一部だが、ガード hook とは呼ばない。** 提供コマンドが「未返信スレッドが 0 でなければ完了にしない」のように拒否するのは、スクリプトのゲート ([抜けを塞ぐのはルールの文言強化ではなく記録とゲートであるべき](../../rules/close-gaps-with-mechanism-not-wording.md))

### 公式の語彙との対応

Claude Code の公式ドキュメントは、この 3 分類に近い語を使い分けている。

- ガード: **guardrail** と **enforcement**。「Put guardrails in hooks. An instruction like "never edit .env" in CLAUDE.md or a skill is a request, not a guarantee. A PreToolUse hook that blocks the edit is enforcement」(Extend Claude Code)。動作の語は **block** と **deny**。security-guidance も「guidance for the reviewer, not deterministic guardrails」「For hard enforcement, pair the plugin with a hook that blocks the edit」と同じ対比で使う
- 誘導: 「Hook output lands in context」「a request, not a guarantee」。名詞は無く、additionalContext と reminder で言う
- 自動化: 「hooks handle automation」「Automation that must run on every matching event」
- **mechanism** は hook 機能そのものを指す語 (「hooks, the mechanism for running your own code at specific points in Claude's loop」)。3 分類の総称に「機構」を使うのはこれとは別の用法なので、本文で「ガード機構」のように必ず目的を前に付ける

AI 業界一般で「ガードレール」と言うとモデル出力のコンテンツフィルタ (Bedrock Guardrails など) を指すことが多い。ここでのガードはツール呼び出しを止める hook と設定のことで、出力フィルタではない。

### frontmatter の `intervention` との関係

`intervention` (prompt / tool / hook / human) は「どの手段で打つか」の軸で、この 3 分類は「何をしたいか」の軸。直交する。
hook は 3 つのどれにもなり得るし、tool (スクリプト) もゲートならガード、エラーメッセージなら誘導になる。

## 使いどころ

- hook やスクリプトに名前を付けるとき。「ガード hook」「誘導 hook」「自動化 hook」のどれかで呼び、単に「hook」や「機構」と書かない
- 知見を書くとき。「機構が止める」「機構化する」と書きそうになったら、ガード hook か、スクリプトのゲートか、誘導 hook かを名指しする
- 新しい仕組みをどこに置くか決めるとき。まず 3 つのどれかを決め、それから手段 (hook か、permissions か、スクリプトか) を選ぶ。手段の選び方はガードなら [権限は permissions.deny ではなく PreToolUse hook で止める](../20-PreToolUse/deny-by-hook-not-permissions.md)、ガードにできるかどうかは block-vs-notice
- 効かない場面: 敵対的な安全境界。3 つのどれもエージェントが settings.json や hook スクリプトを書き換えれば外れる ([ガードの設定と hook スクリプト自身をエージェントから守る](../20-PreToolUse/protect-guard-config-from-the-agent.md))。分類は設計の語彙であって、防御の強さの保証ではない
- Gemini CLI での対応物 (policy engine など) は確かめていない。確かめたら表に列を足す

## 関連

- [hook は注入系とガード系に分かれ失敗時の既定は逆であるべき](injecting-vs-guarding-hooks.md)。失敗時の既定。注入系 = 誘導 + 自動化
- [ガード hook にするか誘導 hook にするかは特定可能性と代替経路で決める](../20-PreToolUse/block-vs-notice-hook-selection.md)。ガードにできる条件
- [ガード hook は enforce / dry-run / off の 3 モードで運用する](guard-hook-enforcement-modes.md)。ガード hook の運用
- [権限は permissions.deny ではなく PreToolUse hook で止める](../20-PreToolUse/deny-by-hook-not-permissions.md)。ガード機構の中での手段の選び方
- [状態を持たない LLM への環境情報は変わる頻度で hook イベントを分けて注入した方がよさそう](split-state-injection-by-staleness.md)。誘導 hook の届くタイミング
- [失敗メッセージには代替手段を名指しで埋め込むべき](../../mcp/name-the-alternative-in-failure-message.md)。hook 以外の誘導
- [抜けを塞ぐのはルールの文言強化ではなく記録とゲートであるべき](../../rules/close-gaps-with-mechanism-not-wording.md)。hook 以外のガード (スクリプトのゲート)
