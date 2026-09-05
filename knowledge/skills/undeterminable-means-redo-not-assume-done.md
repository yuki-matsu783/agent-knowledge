---
type: pattern
nature: principle
title: 判定できないときは「進んだことにする」でなく「もう一度やる」側であるべき
description: >-
  A rule for agent-facing scripts that cannot decide a state: never collapse "unknown" into the side that
  reports progress. A draft-status check returns three values (draft / not draft / unknown) and callers treat
  unknown as "still to be undrafted, run that stage again"; an unrecognized stage name in a state file is
  re-derived from reality rather than rejected with exit 2, because state files the agent may not edit
  leave no one able to fix them; a review finding whose timestamp cannot be read is kept, not dropped.
  Also notes the jq `//` trap that turns `false` into null. Use when writing the "could not determine"
  branch of an idempotent command. Not for guards, where undecidable means deny.
tags: [workflow, tool-use]
keywords: [判定できない, 3 値, 冪等, 再実行, 進んだことにする, is_draft, 未知の state, 再導出, 終了 2 で詰む, 指摘を落とさない, 非対称, jq //, false が null に, 楽観側, 提供コマンド]
status: stable
sources:
  - https://jqlang.github.io/jq/manual/
intervention: tool
---

# 判定できないときは「進んだことにする」でなく「もう一度やる」側に倒す

## 課題

提供コマンドの実装で「判定できない」場面が 3 か所出た。どれも、判定できないことを「判定できた」側のどちらかに畳んだ結果、静かに間違った結論を出していた。

- draft 解除コマンドの `is_draft`: CLI が無い・API が失敗した場合を「draft でない」と同じ扱いにすると、記録を失った環境で「解除済み」に倒れ、何も解除していないのに「解除した」と報告する
- 段階を記録した状態ファイルの再導出: 値が既知の段階名でないときに引数の誤り (終了 2) で止めると、記録は直接編集できない (guard が拒否する) ので人間にも直す手段が残らない
- レビュー完了コマンド: 依頼時刻かホストの時刻を読めなかった指摘を「依頼より前」として落とすと、人間が書いた指摘が黙って消える

3 つとも別々の場面だが、必要な判断は同じ「どちらに倒すか」。

## 解決

**判定できないときは「進んだことにする」側ではなく「もう一度やる」側に倒す。**

- `is_draft` は 3 値 (`draft` / `draft でない` / `判定できない`) を返し、呼び手は「判定できない」を「まだ解除していない」として扱い、解除の段階を実際に実行する。段階の再実行は冪等で、実行していない段階を済んだことにすると取り返せない
- 状態ファイルの値が未知のときは終了 2 で止めず、実態 (リモートの MR の状態、作業領域の中身) から再導出して続ける。**止めることが常に安全側とは限らない。** 記録を直接編集できない設計では、止めると機構の外からも中からも直せない詰みになる。ここでの「拒否側」は「止める」ではなく「もう一度やる」
- 指摘の時刻を読めないときはその指摘を落とさず取得した指摘に含める。損害が非対称で、取りこぼすと人間のレビューが無かったことになるが、余分に 1 件出しても人間が読んで捨てるだけ

場面ごとに個別に決めず、原則を 1 つ置いて適用例を並べる。3 か所で同じ判断が要ったなら、4 か所目でも迷わない。

### jq の `//` が事故の入口

```jq
.draft // empty
```

`//` は `null` と `false` の**両方**を右辺に倒す。draft でない MR (`draft: false`) が「判定できない」に化ける。値の有無 (`has("draft")`) と値そのもの (`.draft == true`) を分けて読む。

## 適用条件

- 効く: 冪等な段階を持つコマンド、記録から状態を復元するコマンド、外部から取得した一覧を処理するコマンド
- 効かない: PreToolUse の guard。そこでは判定できない = 拒否で正しい ([読めない入力はブロック側へ倒す](../hooks/command-position-match-fails-closed.md))。guard の設定破損はまた別 ([復旧経路を残す](../hooks/keep-recovery-path-when-guard-config-breaks.md))
- 「常に終了 1 で止めて人に委ねる」案は、状態ファイルの破損では人にも直す手段が無く、CLI の無い環境では毎回止まる

## トレードオフ

- 得る: 「解除したと報告しながら実際は draft のまま」という最も見つけにくい失敗を作らない
- 失う: 判定できないたびに段階が再実行される。再実行のコストは段階を冪等にすることで払う

## 関連

- [エージェントが呼ぶスクリプトは無言で成功してはならない](agent-scripts-must-not-succeed-silently.md)。「進んだことにする」が無言の成功になる
- [jq の --slurpfile は副入力が壊れていると呼び出し全体を失敗させ stdin の解析まで失う](../hooks/jq-slurpfile-fails-whole-call-on-broken-side-input.md)。jq のもう 1 つの罠
- [エージェントに任せる操作と人間承認が要る操作の線引きは可逆性で決める](../workflow/reversibility-decides-who-acts.md)。取り消せるかで倒す向きを決める同じ軸
