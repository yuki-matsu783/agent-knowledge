---
type: pattern
nature: heuristic
title: worktree ごとに node_modules を作り直さず worktree.symlinkDirectories で main checkout から張った方がよさそう
description: >-
  A pattern for the "every worktree needs its own pnpm install / uv sync" cost of running parallel
  Claude Code agents in git worktrees: declare `worktree.symlinkDirectories` (and, in a monorepo,
  `worktree.sparsePaths`) in settings so each new worktree links `node_modules` or `.venv` from the
  main checkout instead of rebuilding them, and set `worktree.baseRef: "head"` so the worktree starts
  from local commits rather than the remote default branch. Includes what was measured on Windows:
  with Claude Code 2.1.261 in the VS Code extension and the CLI, `symlinkDirectories` created no link
  and reported no error on an account without the symlink privilege, so the setting silently does
  nothing there. Use when subagents or parallel sessions share one toolchain. Not for files that need
  a different value per worktree (ports, .env), which belong in .worktreeinclude or a generator.
tags: [claude-code, multi-agent, workflow, cost]
keywords:
  - worktree.symlinkDirectories
  - worktree.sparsePaths
  - worktree.baseRef
  - worktree.bgIsolation
  - node_modules
  - .venv
  - pnpm install
  - uv sync
  - git worktree
  - EnterWorktree
  - --worktree
  - sparse-checkout
  - シンボリックリンク
  - ジャンクション
  - mklink
  - Windows 特権
  - origin/HEAD
  - fresh
  - head
status: stable
verified_at: 2026-09-05
stale_after: 2027-03-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/settings-reference
  - https://code.claude.com/docs/en/worktrees
intervention: tool
---

# worktree ごとに node_modules を作り直さず worktree.symlinkDirectories で main checkout から張った方がよさそう

## 課題

[並列で走らせるエージェントは git worktree で隔離すべき](parallel-agents-isolated-by-worktree.md) を採ると、worktree は追跡ファイルだけの新しいチェックアウトになる。
gitignore している `node_modules/` と `.venv/` は無いので、worktree の数だけ `pnpm install` と `uv sync` が要る。
時間とディスクを食うだけでなく、[初期化サブエージェント](preflight-subagent-after-plan-before-fanout.md) の案が「worktree ごとに環境を通し直す」で行き詰まる原因になっていた。

もう 1 つ、既定の分岐元が**リモートのデフォルトブランチ** (`origin/HEAD`) なので、push していないコミットが worktree に入らない。
このリポジトリで実測したところ、main が 3 コミット先行している状態で作った worktree は `origin/main` の古い時点で切られ、ローカルでは消したはずの `adr/` `inbox/` が残り、直したばかりの hook スクリプトは古い版だった。

## 解決

Claude Code の `worktree` 設定 (scope は Any file、つまり project settings に書ける) で、worktree の作り方を変える。

```json
{
  "worktree": {
    "baseRef": "head",
    "symlinkDirectories": ["node_modules", ".venv"]
  }
}
```

| キー | 効き方 | 既定 |
|---|---|---|
| `symlinkDirectories` | リポジトリルート相対のディレクトリを、main checkout から各 worktree へシンボリックリンクで張る。複製しない | 未設定 (何も張らない) |
| `sparsePaths` | git sparse-checkout (cone) で列挙したディレクトリとルート直下のファイルだけを書き出す。大きな monorepo 向け。sparse な worktree がある間、共有の `.git/config` に `extensions.worktreeConfig` が入る | 未設定 (全体を書き出す) |
| `baseRef` | `"fresh"` は `origin/<default-branch>`、`"head"` はローカルの `HEAD` から分岐。worktree の中では `"head"` はその worktree の `HEAD` | `"fresh"` |
| `bgIsolation` | 背景セッションの隔離。`"worktree"` は `EnterWorktree` を呼ぶまで main checkout への Edit / Write を止め、`"none"` は作業ツリーを直接編集させる | `"worktree"` |

`--worktree`、`EnterWorktree` ツール、`isolation: worktree` のサブエージェント、背景セッションのすべてに効く。
`.env` のように worktree ごとに値を変えたいファイルはここではなく `.worktreeinclude` (コピー) か生成スクリプトの仕事。

### Windows での実測

Windows 10 (Git Bash)、Claude Code 2.1.261 で `symlinkDirectories: ["node_modules"]` を `.claude/settings.local.json` に置き、3 通り試した。

| 入口 | 結果 |
|---|---|
| VS Code 拡張のセッションから `EnterWorktree` (2 回) | `node_modules` は作られず、エラーも出ない |
| CLI `claude -p --worktree probe-cli` | 同じく無し |
| 同じアカウントで `cmd /c mklink /D` | 特権不足で失敗。`mklink /J` (junction) は成功 |

つまりこの環境では**設定が黙って効かない**。symlink を作る特権 (開発者モードか `SeCreateSymbolicLinkPrivilege`) が無いアカウントでは、Claude Code は junction に落とさず、失敗も報告しない。
Windows で使うなら、先に `mklink /D` が通るアカウントかを確かめる。通らないなら [NTFS の junction](../workflow/ntfs-junction-is-not-a-git-symlink.md) を worktree 作成後に自分で張るか、`WorktreeCreate` hook の中で張る。

## 適用条件

- 効く: worktree が同じツールチェーンを使い、依存の版が main checkout と同じでよいとき。Linux、WSL、Claude Code on the web、symlink 特権のある Windows
- 効かない: worktree ごとに依存の版を変える実験。リンク先は 1 つなので、片方の `pnpm install` がもう片方の足元を書き換える
- `.venv` はリンクしても動くが、`pyvenv.cfg` と scripts が main checkout の絶対パスを指すので、worktree で `uv sync` を打つと main 側の `.venv` が書き換わる。共有していると意識して使う
- `sparsePaths` は monorepo で効く。小さなリポジトリでは意味が無い

## トレードオフ

- 得る: worktree の作成が数秒で終わり、ディスクが増えない。preflight を main checkout で 1 回通せば worktree でも同じ結果になる
- 失う: 隔離が一段弱くなる。並列の 2 セッションが同時に `pnpm install` を打てば同じディレクトリに書く。依存を変えるタスクは worktree でやらない、と判断規則に足す
- `baseRef: "head"` は手元の未 push コミットを持ち込む代わりに、リモートと違う土台で始まる。マージリクエスト前提の作業なら `"fresh"` のままがよい
- Windows では特権の有無で挙動が変わり、失敗が見えない。CI と同じ Linux で試して「効いた」と思い込むと、Windows の同僚の worktree には何も無い

## 関連

- [並列で走らせるエージェントは git worktree で隔離すべき](parallel-agents-isolated-by-worktree.md)。このパターンが減らすのはあちらの「環境構築が worktree の数だけ要る」というコスト
- [計画の直後に初期化サブエージェントを走らせる](preflight-subagent-after-plan-before-fanout.md)。worktree ごとの `pnpm install` をどこに組み込むかの答えの 1 つ
- [NTFS の junction は git の symlink ではない](../workflow/ntfs-junction-is-not-a-git-symlink.md)。Windows で自分で張るときの注意
- [worktree に入ったらガード hook の前提が変わった](../hooks/common/hook-guards-under-worktree-isolation.md)。`baseRef: "fresh"` だと worktree 側のガードがコミット済みの版になる話
