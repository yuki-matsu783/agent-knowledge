---
type: concept
nature: insight
title: context が伸びるほど指示が効かなくなるのは注意が全トークンに配られるから
description: >-
  Explains context dilution: an instruction stops working not because it left the context but
  because attention is a finite budget spread over every token, so each added token takes a share
  from the ones already there. Traces this to the transformer, where every token attends to every
  other token and n tokens produce n-squared pairwise relationships, which is what Anthropic calls
  the attention budget and its consequence context rot. Separates tokens that reside every turn
  (CLAUDE.md, the skill listing, tool definitions, an invoked skill's body) from tokens that pass
  through once (a file read, a tool result), since only the first kind is paid on every turn and so
  is where nearly every design decision lands. Use when you need the shared reason behind skill
  listing budgets, a minimal CLAUDE.md, subagent delegation, or just-in-time loading, or when
  deciding whether to strengthen wording or to remove other tokens. Not a threshold: where quality
  starts dropping is a separate, unsettled question, and this is not measured in this repository.
tags: [context-management, prompting]
keywords:
  - 希薄化
  - context rot
  - attention budget
  - 注意予算
  - transformer
  - n^2
  - 全トークン
  - 常駐
  - just-in-time
  - high-signal
  - 効かない
  - 書いたのに効かない
  - context engineering
  - 最小の高信号トークン
  - 文言の強化
status: stable
verified_at: 2026-09-06
sources:
  - https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
---

# context が伸びるほど指示が効かなくなるのは注意が全トークンに配られるから

## 要点

指示が効かなくなるのは、指示が context から消えたからではない。**入ったまま薄まる**。
注意は有限の予算で context のトークン全体に配られるので、1 トークン足すたびに既にあるトークンの取り分が減る。
だから対策は「強く書く」ではなく「他を減らす」になる。

## 仕組み

Transformer は全トークンが全トークンに注意を配る。n トークンなら n² の関係ができる。
Anthropic はこれを **attention budget** (注意の予算) と呼び、「context は逓減する有限資源として扱わなければならない」と書いている。
その結果として起きる、context が伸びるほど中の情報を正確に思い出せなくなる現象が **context rot**。

ここから 2 つのことが従う。

- **害は入れた本人ではなく既にあるものが受ける。** 新しく足したトークンは注意を取るだけで、失うのは他のトークン。
  足した側は自分の追加が効いているのを見るので、何を犠牲にしたかが見えない
- **窓を広げても解決しない。** 広がるのは容量であって注意ではない。1M トークン入るからといって 1M トークン分の注意は無い

### 常駐するトークンと通り過ぎるトークン

同じ 1,000 トークンでも、毎ターン払うものと 1 回だけ払うものでは害がまるで違う。

| | 例 | いつ払うか |
|---|---|---|
| 常駐 | CLAUDE.md と rules、skill の一覧、ツール定義、起動した skill の本体 | **毎ターン**。compact まで消えない |
| 通り過ぎる | 読んだファイル、ツールの実行結果、1 回の注入 | 出た 1 回だけ (履歴として残るが、それ自体は増え続けない) |

設計の判断がほぼ常駐側に集まるのはこのため。通り過ぎるものを 1 回減らしても 1 回分しか得しないが、
常駐を 1 行減らすとセッションの全ターンで得をする。

## 使いどころ

**対策はどれも「常駐を減らす」の言い換えだと見る。** 個別の対策を別々に覚えるより早い。
Claude Code のどの機能がどの消費源を打ち消すかという product 側の対応は
[機能が分かれているのは context を守るため](../workflow/features-split-to-protect-the-context-window.md)にまとめてある。
ここではモデル側の理由だけを扱う。

skill まわりはこの言い換えがそのまま効く例になっている。

- [skill の総数を絞る](../skills/adding-a-skill-is-paid-by-the-other-skills.md) — 毎ターンの一覧を減らす
- [呼ばれるだけの手順を references に退避する](../skills/caller-only-procedures-belong-in-skill-references.md) — 常駐から、必要になってから読む形へ移す
- [予算を超えると description が落ちる](../skills/skill-description-cut-by-listing-budget.md) — Claude Code が同じことを自動でやっている。選び方は制御できない

**設計の形は 1 つ。** 軽い識別子だけを常駐させ、中身は必要になったときに取りに行かせる (Anthropic の言う just-in-time)。
ファイルパス、skill 名、ツール名は識別子で、本文、description、スキーマは中身。
どこまで識別子に落とせるかが設計の余地になる。

**効かない場面。**

- **閾値は言えない。** 何割で落ち始めるかは[出典によって 40% から 400k トークンまで割れている](context-quality-drop-thresholds-vary-by-source.md)。
  この概念が言うのは向きだけで、どこで切るかは別の判断
- **確実さが要るものには足りない。** 常駐を減らせば効きやすくなるだけで、効くことは保証されない。
  必ず守らせたい規約は[文言ではなく機構で塞ぐ](../rules/close-gaps-with-mechanism-not-wording.md)
- **文言の強化は逆効果になりうる。**「重要」「必ず」を足すのは、守らせたい規約のトークンを増やして他を薄める行為でもある

## 関連

- [Claude Code の機能が分かれているのは context を守るため](../workflow/features-split-to-protect-the-context-window.md)。同じ問いへの product 側の答え。こちらはモデル側の理由
- [context が増えると質が落ち始める閾値は 40% から 400k トークンまで諸説ある (未検証)](context-quality-drop-thresholds-vary-by-source.md)。この概念の「どこで」に当たる部分
- [context に入るものと入るタイミング](../diagrams/what-enters-context-when.dataflow.html)。何が常駐で何が通り過ぎるかを経路として描いた archify のデータフロー図 (ブラウザで開く)
- [CLAUDE.md と @import は system パラメータではなく最初の user メッセージに入る](../rules/claude-md-arrives-as-user-message-not-system-prompt.md)。常駐する指示が届く位置の実測
