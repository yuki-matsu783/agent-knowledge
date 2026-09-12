---
type: pitfall
nature: fact
title: サブエージェントで承認を拒否すると対話にならずそのエージェントの作業が打ち切られる
description: >-
  Describes what happens when a user answers "no" to an approval dialog raised by a tool call made
  inside a Claude Code subagent. Unlike the main agent, which receives the rejection as a tool result
  and waits for the next instruction, a subagent gets no chance to react: a foreground one has its
  whole `Agent` call interrupted and returns no report, and a background one ends with status killed,
  taking the context it had built with it. Use when deciding which work to delegate to a subagent in
  a repository whose PreToolUse guard returns ask, and when choosing between ask and deny for such a
  rule. Not for hook deny, which returns to the agent as an ordinary tool result, and not for nested
  `claude -p` runs, which keep looping after a denial.
tags: [claude-code, multi-agent, security]
keywords: [サブエージェント, Agent ツール, ask, 承認ダイアログ, 拒否, killed, Request interrupted by user for tool use, run_in_background, background, フォアグラウンド, PreToolUse, 打ち切り, 文脈の喪失, deny]
status: stable
verified_at: 2026-09-12
stale_after: 2027-03-12
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/sub-agents
---

# サブエージェントで承認を拒否すると対話にならずそのエージェントの作業が打ち切られる

## 症状

PreToolUse hook が `ask` を返すコマンド (ここでは Bash の `curl`) をサブエージェントに実行させると、承認ダイアログは親の画面に出る。
そこで拒否を選ぶと、潰れるのはツール 1 回ではなくサブエージェントの作業そのものになる。

| 起動の仕方 | 拒否したときに親から見えるもの |
|---|---|
| フォアグラウンド (`run_in_background: false`) | `Request interrupted by user for tool use`。`Agent` ツールの呼び出しごと中断され、サブエージェントの報告は返らない |
| バックグラウンド (既定) | 完了通知が `killed` で届く。要約は利用者による停止 |

どちらも hook の判定は ask まで進み、その直後の PostToolUse が無い。コマンドは実行されていない。

同じ拒否をメインエージェントで受けると、返ってくるのはツール結果としての次の文面で、セッションはそのまま指示待ちになる。

```
The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file
edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to
tell you how to proceed.
```

## 原因

拒否の合図には「作業をやめて人の指示を待て」が含まれている。メインエージェントには待つ相手がいるので待機になるが、
サブエージェントには次の指示を受け取る経路が無い。結果として、待機ではなくそのエージェントの終了として扱われる。
フォアグラウンドは `Agent` 呼び出しの中断、バックグラウンドは `killed` と見え方が違うだけで、実質は同じ。

代償はツール 1 回ではない。サブエージェントがそれまでに読んだもの、調べたもの、組み立てた結論は親に何も返らずに消える。
長く走らせたものほど失うものが大きい。

## 回避策

- **ask に当たりうる工程をサブエージェントに任せない。** 外部取得やコミットのように ask が掛かる手順は、親のターンで先に通しておくか、
  結果だけをサブエージェントに渡す
- **正規経路に寄せてから渡す。** ラッパースクリプトなど allow に載る形に固めておけば、サブエージェントの中で承認を待たずに済む
- **判断が事前に決まっているなら ask ではなく deny にする。** deny はツール結果として返るので、エージェントは拒否を受け取った上で次の手を考えられる。
  ask は人の操作を待つぶん、サブエージェントでは打ち切りに化ける
- 拒否する可能性が残る作業をどうしてもサブエージェントに任せるなら、途中経過を親に返らせるか、作業ファイルに書き出させてから次へ進ませる。
  エージェントが消えても残るものを作っておく

## 再現条件

- Claude Code 2.1.235、VS Code 拡張、Windows 10 の Git Bash。CLI では確かめていない
- 親セッションの permission mode は auto。この状態でも ask のダイアログは画面に出る
- 拒否の操作はフォアグラウンドとバックグラウンドの両方で 1 回ずつ行った。承認した場合はどちらも実行され、結果はサブエージェントの中に返って作業が続いた
- Agent SDK のサブエージェントでは確かめていない

## 関連

- [PreToolUse の ask を誰が答えるかは実行形態で決まる](../hooks/20-PreToolUse/ask-receiver-differs-by-execution-form.md)。4 つの実行形態の一覧
- [サブエージェントは既定で background で走り PostToolUse Agent は起動直後に発火する](subagent-runs-in-background-by-default.md)。`run_in_background` を省くとバックグラウンドになる
- [サブエージェントが効くのは親の節約ではなく新品のコンテキストで考え直せるから](subagent-value-is-a-fresh-context.md)。打ち切りで失われるものの中身
- [ガード hook にするか誘導 hook にするかは特定可能性と代替経路で決めた方がよさそう](../hooks/20-PreToolUse/block-vs-notice-hook-selection.md)
