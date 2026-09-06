---
type: pitfall
nature: fact
title: Bash ツールから入れ子で起動した claude で親セッションのガードを突破できる
description: >-
  Describes how a Claude Code session that is allowed to run `claude` in the Bash tool can spawn a
  headless child session that does not inherit the parent's permission mode, and whose own guards
  can be stripped from the command line with --permission-mode, --dangerously-skip-permissions,
  --setting-sources and --bare. Use when deciding where to store PreToolUse guards and whether to
  allow the `claude` binary in Bash permission rules, especially for unattended or bypassPermissions
  runs. Not for the Task/subagent tool, which stays inside the parent process and keeps its hooks,
  and not for adversarial evasion techniques beyond the documented flags.
tags: [claude-code, security, workflow]
keywords: [claude -p, 入れ子, ヘッドレス, headless, print mode, --bare, --setting-sources, --dangerously-skip-permissions, --permission-mode, acceptEdits, bypassPermissions, permission_denials, managed settings, ANTHROPIC_API_KEY, Not logged in, ガード, 最後の砦, Bash ツール]
status: stable
verified_at: 2026-09-06
stale_after: 2027-03-06
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/permission-modes
  - https://code.claude.com/docs/en/hooks
---

# Bash ツールから入れ子で起動した claude で親セッションのガードを突破できる

## 症状

Bash ツールで `claude` を実行できる状態のセッションは、自分に掛かっているガードが効かない子セッションを立てられる。
素の `claude -p` は無力だが、フラグを 1 つ足すと通る。

VS Code 拡張の Claude Code 2.1.235 から Bash ツール経由で起動し、モデルは haiku 4.5、いずれも `--output-format json` で観測した。

| 入れ子で起動したコマンド | 結果 |
|---|---|
| `claude -p "…"` | Write が拒否され `permission_denials` に載る |
| `claude -p … --permission-mode acceptEdits` | ファイルが書けた |
| `claude -p … --dangerously-skip-permissions` | ファイルが書けた |
| 同上 + プロジェクトの PreToolUse deny hook | hook が止めた。陰性対照のファイルは書けた |
| `claude -p … --dangerously-skip-permissions --setting-sources user` | プロジェクトの hook が読まれず書けた |
| `claude -p … --bare --dangerously-skip-permissions` | `Not logged in · Please run /login` で起動しない |

素の実行が拒否されるときの JSON はこの形になる。

```json
{ "subtype": "success", "is_error": false,
  "permission_denials": [ { "tool_name": "Write", "tool_input": { "file_path": "…", "content": "HELLO" } } ] }
```

## 原因

入れ子の claude は別プロセスの独立したセッションで、親の permission mode も親が承認済みのルールも引き継がない。
`settings.json` から素で立ち上がるので、モードはコマンドラインだけで決まる。入れ子で起動したことを検知して抑止する仕組みは無かった。

素の `claude -p` が安全に見えるのは、承認プロンプトを出す先が無いので ask が deny に倒れるだけ。設計としての防壁ではなく print mode の副作用で、
モードを明示すればその副作用ごと消える。

さらに、設定をどこまで読むかもフラグで変えられる。`claude --help` の記述は次の通り。

- `--setting-sources <sources>` は読み込む設定ソースを `user, project, local` から選ぶ。`project` を外せばリポジトリの `.claude/settings.json` ごと hook が消える
- `--bare` は「skip hooks, LSP, plugin sync, attribution, auto-memory, background prefetches, keychain reads, and CLAUDE.md auto-discovery」。hook を丸ごと落とす

`--bare` には歯止めが 1 つある。Anthropic の認証が `ANTHROPIC_API_KEY` か `--settings` 経由の apiKeyHelper に限定され、OAuth と keychain を読まない。
サブスクリプションのログインだけで使っている環境ではキーが無く、起動そのものが失敗する。Bedrock や Vertex の資格情報があれば通る。

`--setting-sources` の方には認証の歯止めが無く、こちらが実用的な経路になる。

## 回避策

順に硬くなる。

1. **入口を塞ぐ。** `claude` を Bash の allow ルールに入れない。無人運用では親の PreToolUse hook で `claude` の起動そのものを deny する。
   ただし `sh -c` や `node -e` への埋め込みには文字列一致で勝てないので、これだけを頼りにしない
2. **ガードを managed settings に置く。** `--setting-sources` の選択肢は user / project / local で managed が無いので、振り落とせない見込み。
   `C:\ProgramData\ClaudeCode\` が無い環境だったため未実測
3. **`ANTHROPIC_API_KEY` を環境に置かない。** `--bare` の唯一の歯止めがこれ。CI やコンテナでキーを渡す運用では歯止めが消える

親のハーネス側の判断は防御として数えない。auto mode の分類器はリポジトリ直下での `--dangerously-skip-permissions` 実行を止めたが、
一時ディレクトリでの同じ実行は通した。モデルの判断であって規則ではない。

## 再現条件

- Claude Code 2.1.235、VS Code 拡張、Windows 10 の Git Bash。CLI からは確かめていない
- 親も子も permissions の allow / deny ルールは空。子の hook はプロジェクトの `.claude/settings.json` に PreToolUse を 1 つ登録して確かめた
- `--bare` が実際に hook を落とすところは未実測。`ANTHROPIC_API_KEY` が無く起動しなかったため、根拠は `claude --help` の記述だけ
- 親の permission mode を変えて子の挙動が変わらないことは、auto mode からの起動でしか見ていない

## 関連

- [PreToolUse hook は permission の評価より前に走るので deny は全 mode で効く](../20-PreToolUse/hook-deny-runs-before-permission-modes.md)。hook が走らなくなる経路の表にこの 2 つのフラグを載せている
- [権限は permissions.deny ではなく PreToolUse hook で止める](../20-PreToolUse/deny-by-hook-not-permissions.md)。ガードをどちらで引くかの優先順位
- [ガードの設定と hook スクリプト自身はエージェントから守る](../20-PreToolUse/protect-guard-config-from-the-agent.md)。設定の置き場所を managed に寄せる話
- [worktree に入ったらガード hook の前提が変わった](hook-guards-under-worktree-isolation.md)。cwd が変わるとガードの前提が変わる別の例
- [エージェントに任せる操作と人間承認が要る操作の線引きは可逆性で決めるべき](../../workflow/reversibility-decides-who-acts.md)。ヘッドレス実行の倒し方
