---
type: note
nature: finding
title: worktree に入ったらガード hook の前提が変わった
description: >-
  Notes the ways a hook-based guard shifts when a Claude Code session or subagent moves into a git
  worktree. `${CLAUDE_PROJECT_DIR}` stays at the main checkout while the hook input's `cwd` follows
  Claude, guard scripts and settings in the worktree are the committed copies from the base branch,
  gitignored state files such as counters and verdict files are absent from a fresh checkout, and
  "don't ask again" approvals are saved back to the main checkout so they cross every worktree.
  Use when a PreToolUse or PostToolUse guard has to keep holding for parallel or isolated agents.
  Includes what another project measured: a guard that resolves its state from the script's own
  location reads the main checkout's empty state inside a worktree and lets everything through, and
  a naive "walk up from cwd to the nearest .claude" is bypassed by a plain cd. Not measured in this
  repository, and not a general introduction to worktrees.
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
  - fresh checkout
  - 無効化
  - 素通り
  - gitdir
  - 相互参照
  - 共有ルート
  - 進行状態
status: stable
sources:
  - https://code.claude.com/docs/en/worktrees
  - https://code.claude.com/docs/en/hooks
  - knowledge/agents/parallel-agents-isolated-by-worktree.md
---

# worktree に入るとガード hook の前提が変わる

[並列で走らせるエージェントは git worktree で隔離する](../../agents/parallel-agents-isolated-by-worktree.md) を採ると、
hook で組んだガードの足元が動く。ガードは「どのファイルを見るか」「どこに状態を書くか」を暗黙に
1 つのチェックアウトに固定して書かれているためで、worktree はその前提を 2 つに割る。

## 割れる 4 点

### 1. hook スクリプトの解決先が 2 つある

Claude が worktree に入っても `${CLAUDE_PROJECT_DIR}` は**セッションを起動したプロジェクトルートに留まる**。
一方 hook の入力 JSON の `cwd` は Claude に追従して worktree ルートになる。

つまり `${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.sh` と登録したガードは、Claude が worktree で作業していても
main checkout 側のスクリプトが走る。編集対象は worktree の中にあるのに、スクリプトが基準にする場所は
main checkout。この食い違いを埋めるには、hook が `cwd` を読んで判定の基準に使う必要がある。

別プロジェクトの実測では、これを埋めていないガードは worktree に入った瞬間に**丸ごと無効化**した。
スクリプトの置き場 (`BASH_SOURCE`) からリポジトリルートを解決していたため、「作業中のチケットが無ければ許可」
という判定が main checkout 側の空の状態を見て、書き込みも実行もすべて素通りした。ロックアウトは気づいて直せるが、
無効化は静かに全部通るので、こちらの方が悪い。

`cwd` を読む側にも罠がある。「`cwd` から上向きに `.claude` を持つディレクトリを探す」だけだと、リポジトリ内に
別の `.claude` (参考実装のコピーなど) があるとき `cd` 1 回でそちらが作業ツリーとして採られ、同じ素通りが起きる
(同じプロジェクトで実測)。候補が本当に main checkout の worktree かを、`.git` ファイルの `gitdir:` と
`.git/worktrees/*/gitdir` の**相互参照を双方向**で確かめる。片方向だと、消した worktree の stale な登録が指す場所に
ディレクトリを置くだけで信用される。確かめられなければ main checkout に倒す。判定が厳しい側に寄るだけで、消えはしない。

### 2. worktree 側のガードはコミット済みの版

worktree は新しいチェックアウトで、既定の分岐元はリポジトリのデフォルトブランチ (`worktree.baseRef: "fresh"`)。
`.claude/hooks/` も `.claude/settings.json` もそのブランチの内容が入る。手元でガードを強化しても、
コミットして push するまで worktree には届かない。

`EnterWorktree` で `.claude/worktrees/` の外のパスに移るときに Claude Code が確認を求めるのは、この移動が
「作業ディレクトリと書き込み権と `CLAUDE.md`・settings といったプロジェクト設定」ごと移すため。
設定の出所が変わるという事実が、確認を挟む理由そのものになっている。

### 3. 状態ファイルが worktree ごとにリセットされる

カウンタ、フラグ、判定ファイルは gitignore された場所に置くのが普通なので、fresh checkout には存在しない。
[ツール使用回数を閾値にして、文脈を持たない監査サブエージェントを背景で走らせる](../../agents/context-free-audit-subagent-on-tool-count.md)
のような回数ベースのガードは、worktree ごとに 0 から数え直す。並列で 3 本走らせれば、どれも閾値に届かないまま
全体では 3 倍のツール呼び出しが起きる。

`.worktreeinclude` に書けば作成時にコピーされるが、**コピーであって共有ではない**。worktree 側の書き込みは
main にも他の worktree にも戻らない。全体で 1 つのカウンタを持ちたいなら、main checkout の絶対パス
(`${CLAUDE_PROJECT_DIR}` はここに留まるので使える) に書きに行くか、worktree の外に状態を置く。

状態を丸ごと worktree 側に置いた別プロジェクトでは、worktree を使った瞬間に 4 つが同時に壊れた。
振り分けの宣言の記録が無いので宣言済みセッションでも未宣言として拒否される、承認の記憶が無いので同じセッションで承認を取り直す、
MR やレビューの進行状態が「無い」扱いになる、ロックと集計が worktree ごとに分裂して同じブランチへの排他も集計も成立しない。
落としどころは**置き場の性質で 2 つに分ける**こと。issue やブランチに属する進行状態・ロック・集計・セッションの記憶は
main checkout の 1 か所へ、「どの作業ツリーで何が起きたか」の判定記録と実行ログだけを worktree 側に残し、
レコードに `cwd` とサブエージェント ID を足して合流後も切り分けられるようにする。
共有側の置き場を環境変数で差し替え可能にしない。進行状態の保護対象を外から外せる口になる。

### 4. 許可だけは横断する

worktree のセッションで「はい、次回から確認しない」を選ぶと、そのルールは main checkout の
`.claude/settings.local.json` に保存され、main checkout と他の全 worktree に効く。worktree を消しても残る。
ファイルは隔離されているのに、権限の緩和だけは全体に伝播する。

ただし公式は例外を書いている。**Windows と、Claude Code がリポジトリルートを settings の置き場に使わない構成では、ルールはその worktree に留まる。**
Windows 想定のリポジトリでは「横断する」を前提にせず、逆に「worktree を消すと承認も消える」側で考える。

## 逆に無料で手に入るガード

worktree で隔離されている間は、main checkout への `Edit` / `Write` / `NotebookEdit`、main checkout に解決される
作業ディレクトリ、git を main checkout に向けるリダイレクト、行き先を判定できない形のコマンドを
Claude Code 自身が止める。最後のチェックは無効化できない。

つまり「main checkout を守る」だけが目的のガードは、worktree を使う構成では自作しなくてよくなる。
[Edit/Write を deny してもスクリプト経由でファイルは書き換わる](../20-PreToolUse/protected-file-rewritten-via-subprocess.md)
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

- **相対パスで登録した hook コマンド** (`sh .claude/hooks/guard.sh` のような形) は、公式が「ハンドラは現在のディレクトリで走る」
  「絶対パスを使え」と書いているので、cwd がルート以外なら解決できず exit 127 になる。fail-closed のラッパで包んでいると
  全 deny のロックアウトになる。別プロジェクトはこれを理由に絶対パス登録へ変えたが、worktree の中で相対パスがどこへ解決するかは
  当リポジトリでは試していない
- `isolation: worktree` のサブエージェントが発火させる PostToolUse hook が、どの `cwd` を受け取るか
- worktree ごとのカウンタを 1 本にまとめる実装。案は書いたが動かしていない
- 上の「丸ごと無効化」「`cd` によるバイパス」「状態の 4 点同時破損」は別プロジェクトの実測で、当リポジトリでは再現していない。
  それ以外は 2026-09 時点のドキュメントからの読み取り

## 昇格の目安

- [ ] 粒度が type の定義に収まっている (割れる点が 4 つあるので、`pitfall` にするなら分割が要る)
- [ ] sources に一次情報がある
- [ ] 実際に worktree でガードを走らせて applies_to と verified_at を書ける
