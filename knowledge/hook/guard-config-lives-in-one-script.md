---
type: pattern
nature: best-practice
title: ガードの判定はスクリプト 1 箇所に集め settings.json には入口だけを置くべき
description: >-
  A layout rule for Claude Code guard hooks so that "what is enforced right now" can be read in one place:
  settings.json holds a single PreToolUse entry with a broad matcher (Bash or empty) and no `if` filter, every
  banned command lives in the hook script or one data file beside it, and permissions.deny keeps only absolute
  lines such as secret reads and the guard's own files. Explains why the script is the more reliable matcher
  (it owns the normalization of `git -C`, `/usr/bin/git`, `bash -c` and the fail-closed direction, which
  neither `if` nor deny rules let you configure, and the docs call `if` best-effort) and what must still live
  outside it. Use when adding a banned command and wondering whether it goes in `if`, `permissions.deny`, or
  the script, or when nobody can tell which of the four places is enforcing what. Applies to advisory and
  logging hooks as well, since they lose the same readability; `if` earns its place only for hooks whose
  startup cannot be made cheap (Node or Python bodies, prompt or agent hooks, plugin hooks you cannot edit).
  Not a claim that a hook beats deny rules when the hook returns no decision at all.
tags: [claude-code, security, workflow]
keywords: [settings.json, PreToolUse, matcher, if フィルタ, best-effort, permissions.deny, rules.toml, 入口 1 本, 二重管理, 設定が散る, 判定の置き場, 正規化, fail-closed, 絶対線, ガード hook, guard-and-guide, git -C, bash -c]
status: stable
verified_at: 2026-09-05
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/permissions
  - knowledge/hook/deny-by-hook-not-permissions.md
intervention: hook
---

# ガードの判定はスクリプト 1 箇所に集め settings.json には入口だけを置く

## 課題

禁止したいコマンドを止められる場所が 4 つある。settings.json の hook エントリの `if`、`permissions.deny`、hook スクリプト内の判定、
そして managed settings。禁止事項を 1 つ足すたびにどこへ書くか迷い、書いたあとは 4 箇所を突き合わせないと「今なにが効いているか」が読めない。
同じルールが `if` と deny とスクリプトに分かれると二重管理になり、片方だけ直して食い違う。

照合の賢さも場所で違う。`if` と permission rule は「最初の `*` より前を書いたとおりに照合する」固定規則で、
`Bash(git commit *)` は `git -C /repo commit`、`/usr/bin/git commit`、`bash -c "git commit"` に一致しない。
公式の hooks リファレンスも `if` を best-effort と明記し、確実な allow / deny には permission システムを使えとしている。
ただし deny 側も照合規則は同じなので `git -C` は同じように抜ける。どこまで正規化するか、読めない入力をどちらへ倒すかを
自分で決められるのはスクリプトだけ。

## 解決

3 層に分け、**判定は 1 層にしか置かない**。

| 場所 | 置くもの | 変わる頻度 |
|---|---|---|
| settings.json | 入口 1 本。`PreToolUse`、matcher は `Bash` (か空)、`if` は書かない、`timeout` を明示 | 一度書いたら変えない |
| hook スクリプト (かその隣のデータファイル 1 つ) | 禁止事項、正規化、失敗の向き、拒否理由と代替の呼び方 | 禁止事項の追加のたび |
| `permissions.deny` | hook というプロセスが挟まること自体を信用しない絶対線 (秘密ファイルの `Read` など) と、ガードの設定・スクリプト自身を守る名指し | ほぼ変えない |

```json
{ "hooks": { "PreToolUse": [
  { "matcher": "Bash",
    "hooks": [ { "type": "command", "command": "sh \"${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.sh\"", "timeout": 10 } ] }
] } }
```

- **settings.json に `if` を書かない。** 書いた瞬間に判定が 2 箇所になる。しかも `if` は精密判定の超集合にならないので、
  スクリプトに届かない入力が生まれる ([hook の前置フィルタは精密判定の超集合でなければならない](hook-prefilter-must-stay-superset.md) と同じ形)
- **ルールはデータにする。** guard-and-guide の `rules.toml` のように 1 件 = matcher + 正規表現 + メッセージの行にすると、
  追加が 1 行で済み、diff を見れば何が変わったか分かる
- **`permissions.deny` にコマンドの禁止事項を並べ始めない。** スクリプト側と二重になるうえ、deny は理由も代替も返せないので言い換えの再試行を誘発する
- settings.json は JSON でコメントを書けないので、スクリプト名を役割で付け (`guard.sh`)、ルール表の場所はスクリプト冒頭のコメントに書く。
  settings.json を開いた人がそこから辿れる

## 適用条件

- 効く: 自分で sh で書く hook 全部。ガード系はもちろん、注入系 (注意喚起、ログ) も同じ。`if` で省けるのはプロセス起動 1 回分 (純 sh で 100ms 前後) で、
  その代わりに判定が 2 箇所に割れ、照合漏れで注意喚起が出なかった回に気づけなくなる。対象外ならスクリプト先頭で `exit 0` すればよい
- `if` が見合うのは起動を軽くできないときだけ。Node や Python で書いた hook を稀なイベントに掛ける、`type: prompt` / `type: agent` のように発火ごとに LLM を呼ぶ、
  自分で直せない plugin の hook を絞る、の 3 つ
- スクリプト判定が deny に劣るのは照合ではなく**判定が出なかったとき**。timeout、スクリプト自体の異常終了、エージェントによる書き換えの
  3 つを既存の対策で塞いでいることが前提 (関連の 3 件)

## トレードオフ

- 得る: 効いているルールが 1 ファイルで読める。追加が 1 行。拒否に理由と代替が付く
- 失う: ガード hook が全 Bash 呼び出しで走り、`if` で削れたはずの起動コストを払う。fork 0 回の純 bash なら 100ms 前後なので、
  判定の抜けと引き換えにする価値は無い
- deny を絶対線に限ると「hook が死んでも止まる」保証はその絶対線にしか無い。コミット経路の強制のように 1 回抜けても取り返せるものだけを
  スクリプト側に置く

## 関連

- [権限は permissions.deny ではなく PreToolUse hook で止める](deny-by-hook-not-permissions.md)。「入口を 1 本にする」の具体化
- [hook のコマンド判定は正規化とコマンド位置の走査にし読めない入力はブロック側へ倒す](command-position-match-fails-closed.md)。スクリプト側の判定の中身
- [タイムアウトした hook はガードにならず素通りする](hook-timeout-fails-open.md)、[hook を注入系とガード系に分け、失敗時の既定を逆にする](injecting-vs-guarding-hooks.md)、[ガードの設定と hook スクリプト自身をエージェントから守る](protect-guard-config-from-the-agent.md)。判定が出ない 3 つの原因と対策
- [ガード hook は enforce / dry-run / off の 3 モードで運用する](guard-hook-enforcement-modes.md)。モード切り替えも環境変数で持ち、settings.json に置かない
