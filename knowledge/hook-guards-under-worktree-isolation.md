---
type: note
title: worktree に入るとガード hook の前提が変わる
description: >-
  Notes the ways a hook-based guard shifts when a Claude Code session or subagent moves into a git
  worktree. `${CLAUDE_PROJECT_DIR}` stays at the main checkout while the hook input's `cwd` follows
  Claude, guard scripts and settings in the worktree are the committed copies from the base branch,
  gitignored state files such as counters and verdict files are absent from a fresh checkout, and
  "don't ask again" approvals are saved back to the main checkout so they cross every worktree.
  Use when a PreToolUse or PostToolUse guard has to keep holding for parallel or isolated agents.
  Not a verified account, since the path-resolution and counter behavior here is read from docs and
  not measured, and not a general introduction to worktrees.
tags: [claude-code, security, workflow]
keywords:
  - worktree
  - CLAUDE_PROJECT_DIR
  - cwd
  - PreToolUse
  - PostToolUse
  - ガード
  - hook
  - .worktreeinclude
  - settings.local.json
  - 許可の保存先
  - isolation
  - 状態ファイル
  - カウンタ
  - 判定ファイル
  - wip/local
  - fresh checkout
  - baseRef
status: stable
sources:
  - https://code.claude.com/docs/en/worktrees
  - https://code.claude.com/docs/en/hooks
  - knowledge/parallel-agents-isolated-by-worktree.md
---

# worktree に入るとガード hook の前提が変わる

[並列で走らせるエージェントは git worktree で隔離する](parallel-agents-isolated-by-worktree.md) を採ると、
hook で組んだガードの足元が動く。ガードは「どのファイルを見るか」「どこに状態を書くか」を暗黙に
1 つのチェックアウトに固定して書かれているためで、worktree はその前提を 2 つに割る。

## 割れる 4 点

### 1. hook スクリプトの解決先が 2 つある

Claude が worktree に入っても `${CLAUDE_PROJECT_DIR}` は**セッションを起動したプロジェクトルートに留まる**。
一方 hook の入力 JSON の `cwd` は Claude に追従して worktree ルートになる。

つまり `${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.sh` と登録したガードは、Claude が worktree で作業していても
main checkout 側のスクリプトが走る。編集対象は worktree の中にあるのに、スクリプトが基準にする場所は
main checkout。この食い違いを埋めるには、hook が `cwd` を読んで判定の基準に使う必要がある。

### 2. worktree 側のガードはコミット済みの版

worktree は新しいチェックアウトで、既定の分岐元はリポジトリのデフォルトブランチ (`worktree.baseRef: "fresh"`)。
`.claude/hooks/` も `.claude/settings.json` もそのブランチの内容が入る。手元でガードを強化しても、
コミットして push するまで worktree には届かない。

`EnterWorktree` でリポジトリ外のパスに移るときに Claude Code が確認を求めるのは、この移動が
「作業ディレクトリと書き込み権と `CLAUDE.md`・settings といったプロジェクト設定」ごと移すため。
設定の出所が変わるという事実が、確認を挟む理由そのものになっている。

### 3. 状態ファイルが worktree ごとにリセットされる

カウンタ、フラグ、判定ファイルは gitignore された場所に置くのが普通なので、fresh checkout には存在しない。
[ツール使用回数を閾値にして、文脈を持たない監査サブエージェントを背景で走らせる](context-free-audit-subagent-on-tool-count.md)
のような回数ベースのガードは、worktree ごとに 0 から数え直す。並列で 3 本走らせれば、どれも閾値に届かないまま
全体では 3 倍のツール呼び出しが起きる。

`.worktreeinclude` に書けば作成時にコピーされるが、**コピーであって共有ではない**。worktree 側の書き込みは
main にも他の worktree にも戻らない。全体で 1 つのカウンタを持ちたいなら、main checkout の絶対パス
(`${CLAUDE_PROJECT_DIR}` はここに留まるので使える) に書きに行くか、worktree の外に状態を置く。

### 4. 許可だけは横断する

worktree のセッションで「はい、次回から確認しない」を選ぶと、そのルールは main checkout の
`.claude/settings.local.json` に保存され、main checkout と他の全 worktree に効く。worktree を消しても残る。
ファイルは隔離されているのに、権限の緩和だけは全体に伝播する。

## 逆に無料で手に入るガード

worktree で隔離されている間は、main checkout への `Edit` / `Write` / `NotebookEdit`、main checkout に解決される
作業ディレクトリ、git を main checkout に向けるリダイレクト、行き先を判定できない形のコマンドを
Claude Code 自身が止める。最後のチェックは無効化できない。

つまり「main checkout を守る」だけが目的のガードは、worktree を使う構成では自作しなくてよくなる。
[Edit/Write を deny してもスクリプト経由でファイルは書き換わる](protected-file-rewritten-via-subprocess.md)
で問題になる抜け道も、行き先が main checkout なら製品側の作業ディレクトリ判定に掛かる。
守る対象が worktree の中のファイル (生成物の手編集を止める、など) なら、従来どおり自分のガードが要る。

## 対策の当て

- hook のコマンドはパスを `${CLAUDE_PROJECT_DIR}` で絶対指定し、**判定の基準は入力 JSON の `cwd` にする**。
  「スクリプトの在り処」と「作業中のツリー」を別物として扱う
- ガードの強化はコミットしてからでないと worktree に効かない前提で運用する。
  [ガード hook は enforce / dry-run / off の 3 モードで運用する](guard-hook-enforcement-modes.md) のモード切り替えを
  未コミットのファイルで持たない
- セッション横断で数えたい状態は `${CLAUDE_PROJECT_DIR}` 配下の 1 か所に集約し、書き込み時に worktree 名で
  レコードを分ける。`.worktreeinclude` でのコピーは初期値の配布にだけ使う
- 「次回から確認しない」を無人セッションで押させない。押した瞬間に全 worktree の権限が緩む

## 確かめていないこと

- **相対パスで登録した hook コマンド** (`sh .claude/hooks/guard.sh` のような形) が、worktree では worktree 側の
  スクリプトを走らせるのか。ドキュメントは「ハンドラは現在のディレクトリで走る」としか書いておらず、
  相対パスの解決先を明示していない。上の「main checkout 側が走る」は絶対指定した場合の話
- `isolation: worktree` のサブエージェントが発火させる PostToolUse hook が、どの `cwd` を受け取るか
- worktree ごとのカウンタを 1 本にまとめる実装。案は書いたが動かしていない
- ここに書いた対策はどれも試していない。すべて 2026-09 時点のドキュメントからの読み取り

## 昇格の目安

- [ ] 粒度が type の定義に収まっている (割れる点が 4 つあるので、`pitfall` にするなら分割が要る)
- [ ] sources に一次情報がある
- [ ] 実際に worktree でガードを走らせて applies_to と verified_at を書ける
