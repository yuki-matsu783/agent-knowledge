---
type: pitfall
nature: fact
title: EnterWorktree で worktree に入ってもプロジェクト設定は起動ディレクトリのものが効き続ける
description: >-
  Explains that Claude Code's EnterWorktree moves the session's working directory into the worktree
  but does not rebind project context. `.claude/settings.json` and `CLAUDE.md` keep coming from the
  directory the session was launched in, including uncommitted edits, while the hook input's `cwd`
  and any repository-relative hook command resolve inside the worktree instead, so a guard's
  registration comes from the main checkout and its script body from the branch. Use when a guard,
  lint, or memory rule behaves unexpectedly after entering a worktree, or when deciding between
  entering a worktree from the current session and launching a new session inside it. Not for how
  worktrees are created, and not for state files or saved "don't ask again" approvals.
tags: [claude-code, workflow, security]
keywords:
  - EnterWorktree
  - worktree
  - settings.json
  - CLAUDE.md
  - CLAUDE_PROJECT_DIR
  - cwd
  - PreToolUse
  - 相対パス
  - プロジェクト設定
  - 束縛
  - main checkout
  - 未コミット
  - .claude/worktrees
  - 直接起動
  - 入れ子
status: stable
verified_at: 2026-09-07
stale_after: 2027-03-07
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/worktrees
  - https://code.claude.com/docs/en/hooks
---

# EnterWorktree で worktree に入ってもプロジェクト設定は起動ディレクトリのものが効き続ける

## 症状

worktree に入れば「その worktree の設定で動く」と思っていると、実際には食い違う。
本体で起動したセッションが `EnterWorktree` で worktree に移った後、次のように割れた。

| 見るもの | どこのものが効いたか |
|---|---|
| `.claude/settings.json` (hook の登録、matcher) | 本体。**未コミットの編集まで反映された** |
| `CLAUDE.md` | 本体 |
| `$CLAUDE_PROJECT_DIR` | 本体 |
| hook 入力 JSON の `cwd` | worktree |
| `sh .claude/hooks/guard.sh` と相対で登録した hook 本体 | worktree のコミット済みコピー |

つまり**「何を登録するか」は本体が持ち、「実際に走るスクリプトの中身」は worktree が持つ**。
手元でガードを直しても登録は即座に効くのに、スクリプトの中身はコミットするまで worktree に届かない。
逆に、worktree のブランチでガードのスクリプトを弱めれば、本体の登録はそのままに中身だけ入れ替わる。

worktree で `claude` を直接起動した場合は割れない。settings.json も `CLAUDE.md` も `$CLAUDE_PROJECT_DIR` も
すべて worktree のものになる。本体の `.claude` を丸ごと消した状態でも worktree のセッションは完全に動いた。

## 原因

プロジェクト設定はセッション起動時のディレクトリに束縛され、`EnterWorktree` は作業ディレクトリを動かすだけで
その束縛を張り替えない。追従するのは cwd を基準に解決されるものだけで、相対パスの hook コマンドがこれに当たる。

親方向の探索は起きていない。worktree を `.claude/worktrees/` の下、つまり本体の中に置いた状態で worktree を
直接起動しても、本体の `CLAUDE.md` も本体の `settings.json` も読まれなかった。worktree は自身が git のトップレベルなので、
そこで探索が止まっていると読める。

## 回避策

- 「worktree の中が全部」という認知で使いたいなら、`EnterWorktree` ではなく **worktree のディレクトリでセッションを起動する**。
  それだけで settings・`CLAUDE.md`・hook・`$CLAUDE_PROJECT_DIR` が worktree に揃う
- 同じセッションのまま `EnterWorktree` を使うなら、本体の settings.json を matcher と相対パスだけの薄いディスパッチャにし、
  判定ロジックを全部スクリプト側に出す。中身が worktree に追従する
- ツリー固有の規約は `CLAUDE.md` に書かない。張り替わらないので、
  [worktree 固有の規約は EnterWorktree の PostToolUse で注入する](../hooks/22-PostToolUse/inject-worktree-rules-on-enter-worktree.md) で入れる
- スクリプトの中で `$CLAUDE_PROJECT_DIR` を「今いるツリー」として使わない。hook 入力の `cwd` を受けて
  `git -C "$cwd" rev-parse --show-toplevel` でルートを出す
- worktree は `.claude/worktrees/` ではなく本体の外に置く。入れ子にしても文脈上の利点は無い一方で、
  本体の `.claude` を消すと worktree ごと消え、本体で `git add -A` すると embedded git repository の警告が出て
  worktree が index に入りかける (実測で踏んだ)
- ガードの中身がブランチの内容になるということは、エージェントが自分のブランチでガードを弱められるということ。
  改竄されて困るものだけ `${CLAUDE_PROJECT_DIR}` の絶対パス登録に残す。worktree 完結とは両立しないので、そこは割り切る

## 再現条件

Claude Code 2.1.235 の CLI (`claude -p`) を Windows の Git Bash で実行。**VS Code 拡張では確かめていない。**
使い捨てのリポジトリを作り、`.claude/settings.json` の hook が書き出すマーカーを
「本体の未コミット版」「コミット済み版」「worktree 自身のコピー」の 3 種類に分けて、どれが発火するかで判定した。

- `cwd` は Windows で `C:\...` のバックスラッシュ形式、`$CLAUDE_PROJECT_DIR` は `/` 形式で来た。
  正規化せずに文字列比較すると「worktree にいるか」の判定が黙って外れる
- `claude -c` でセッションを継続したところ、worktree の cwd は復元されず hook は本体を見た。
  拡張の対話セッションで別ターンを回したときにどうなるかは確かめていない

## 関連

- [並列で走らせるエージェントは git worktree で隔離すべき](parallel-agents-isolated-by-worktree.md)。この構成が前提
- [worktree に入ったらガード hook の前提が変わった](../hooks/common/hook-guards-under-worktree-isolation.md)。状態ファイルと承認の扱い
- [hook は CLAUDE_PROJECT_DIR 基準の絶対パスで登録しないと cwd 次第で全 deny のロックアウトになる](../hooks/common/register-hooks-with-absolute-project-dir-path.md)。相対登録のもう一方の危険
