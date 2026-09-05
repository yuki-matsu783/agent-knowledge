---
type: pitfall
nature: fact
title: dir/** の glob はディレクトリ自身と祖先に一致しないので rm -rf dir が守りをすり抜ける
description: >-
  Explains a hole in path-glob guards: a protection pattern like `wip/tickets/done/**` matches files
  below that directory but not `rm -rf wip/tickets/done` itself, nor `rm -rf wip/tickets` or `rm -rf wip`,
  so a guard that blocks deleting individual records lets the whole tree go. Changing the glob semantics
  breaks every other pattern (`.claude/**` would then match the repository root), so the fix is to list
  the directory and its ancestors explicitly in that one check, to judge the source side of rm/mv and
  not only the destination, and to pin the deletable directories with a negative control in tests. Use
  when a guard protects a directory tree by glob. Not for glob syntax in general.
tags: [claude-code, security]
keywords: [glob, "**", ディレクトリ自身, 祖先, rm -rf, git rm, mv, 元, 宛先, 保護対象, すり抜け, 負のコントロール, workflow-state-guard, パターン位置より下]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
---

# dir/** の glob はディレクトリ自身と祖先に一致しないので rm -rf dir が守りをすり抜ける

## 症状

作業中・完了済みのチケットの置き場を守る guard が、`rm wip/10_tickets/20_done/0003.md` は止めるのに、次はどれも止めなかった。

| コマンド | `wip/10_tickets/20_done/**` に一致するか |
|---|---|
| `rm wip/10_tickets/20_done/0003.md` | する → 拒否 |
| `rm -rf wip/10_tickets/20_done` (ディレクトリ自身) | **しない** |
| `rm -rf wip/10_tickets` | **しない** |
| `rm -rf wip` | **しない** |

ファイル単位の削除を塞いでディレクトリ単位を通しているので、塞いだことになっていない。1 段上ほど穴が大きく、`rm -rf wip` は進行状態・チケット・計画書・結果報告をまとめて消す。

## 原因

glob の `**` は「0 個以上のディレクトリに一致する」だが、それは**パターンの位置より下**を指す。パターン自身の親には一致しない。
テストにもディレクトリ削除のケースが無かったので、ファイル単位の穴を塞いだ時点で「塞いだ」と信じていた。

もう 1 つ、この guard は元々「`mv` / `cp` / `git mv` / `touch` / リダイレクトの**宛先**」しか見ていなかった。`rm` は宛先を持たないので一覧に無く、消す経路そのものを見落としていた。
削除は置き場から状態を消す操作で、作成・移動と同じ強度で守るべきもの。

## 回避策

- **glob の規則は変えない。** `wip/10_tickets/20_done/**` が親に一致するように意味を変えると、`.claude/**` がリポジトリルートに一致するなど他のすべての判定が壊れる
- **その 1 か所で明示的に書く。** 元が `<置き場>/**` に一致するか、**その置き場のディレクトリ自身またはその祖先**であるとき拒否する。祖先は正規化したパスの前方一致で足りる (列挙するのは `wip` と `wip/10_tickets` の 2 つ)。
  祖先の削除はどの置き場も消すので、識別子は「作業中の置き場が消える」側に倒す (完了済みは git 履歴から戻せるが、作業中の途中状態は戻せない)
- **`rm` / `git rm` / `mv` / `git mv` の「元」を判定する。** 宛先だけでは削除を拾えない。オプションを除いた位置引数を取り、`rm` なら全部が元、`mv` なら最後が宛先で残りが元
- **負のコントロールをテストに置く。** `rm -rf wip/tmp` と `rm -rf logs` は通ること。「拒否される」だけの assert は、パスの抽出が壊れて何でも拒否する故障でも通る
- `rm -r` / `--recursive` があるときだけ拾う案は、書き方を数える必要があり、`rm wip/10_tickets/20_done` (空なら成功する) を取りこぼす
- `wip/**` を丸ごと保護する案は、作業用の一時ファイルや計画書への正当な書き込みまで止める

「作業中のチケットが無ければ判定しない」窓を持つ別の guard に任せる案は、まさにその窓で削除が起きるので効かない。作業中の有無を問わず判定する guard が持ち主になる。

## 再現条件

純 bash で glob をパス照合に使う hook。`**` を「0 個以上のディレクトリ」と定義している限り、実装によらず同じ。

## 関連

- [削除は保護 glob が対象で始まるかで判定し配下を列挙しない](judge-deletes-by-protected-glob-prefix.md)。ディレクトリを消してよいかを「配下に守るものを含み得るか」で見る、向きを逆にした判定
- [共有ライブラリは分類までにし規約との照合は呼び手が行う](../scripts/shared-library-classifies-caller-matches-rules.md)。位置引数を取り出す関数はライブラリ、元と宛先の解釈は呼び手
- [hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒す](command-position-match-fails-closed.md)
