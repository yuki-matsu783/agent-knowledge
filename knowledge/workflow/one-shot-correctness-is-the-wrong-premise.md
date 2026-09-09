---
type: concept
nature: principle
title: エージェントの使い方は 1 回で正解が出る前提ではなく、必ず外す前提で組むべき
description: >-
  Argues that "get it right in one shot" is the wrong premise for using a coding agent, because the
  output is sampled and the same prompt does not reproduce the same result; wording only moves the
  distribution, it never collapses it to a point, so effort spent on the last increment of one-shot
  accuracy buys less than effort spent on catching and undoing a wrong run. Replaces the design goal
  with three: judge every run mechanically, make a retry cheap, and cap the blast radius of a wrong
  run by reversibility. Contrasts this with a deterministic system, where a design fixes the behaviour
  and one passing run stands for all later ones, and notes that human development is not one-shot
  either, so that the scaffolding
  a human developer uses without noticing — running the code, reading the error, throwing a version
  away, remembering the last mine, stopping before something irreversible — has to be handed to the
  agent explicitly. Use when a workflow assumes the agent's first answer is usable, when a rule
  keeps being reworded because it was skipped once, or when deciding where to spend effort between
  prompt quality and checks. Not a claim that prompt quality is worthless, not a measured success
  rate, and not the ratchet mechanics of repeated runs.
tags: [claude-code, prompting, workflow, evaluation]
keywords:
  - 1 回で正解
  - ワンショット
  - 試行錯誤
  - 確率的
  - 非決定
  - 足場
  - 再現しない
  - サンプリング
  - 分布
  - 成功率
  - プロンプトエンジニアリング
  - 指示を磨く
  - 間違える前提
  - 決定的
  - やり直し
  - 人間の開発
  - 検査
  - 被害限定
  - 可逆性
  - request not a guarantee
status: stable
verified_at: 2026-09-09
stale_after: 2027-03-09
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/security-guidance
  - https://www.anthropic.com/engineering/building-effective-agents
---

# エージェントの使い方は 1 回で正解が出る前提ではなく、必ず外す前提で組むべき

## 要点

エージェントの出力は確率的に選ばれるので、同じ指示を出しても同じ結果にはならない。
指示を磨く行為は出力の**分布を寄せる**ことであって、1 点に潰すことではない。
だから設計の目標を「1 回で正解を出させる」に置くと伸びない部分に労力が向く。
置くべき目標は「**外した回が安く見つかって安く戻せる**」で、正解率を上げる努力はその上に載せる。
完璧に設計すれば 1 回で完璧な出力が出る、という決定的なシステムの読み方はここでは成り立たない。
人間の開発も試行錯誤で成果物に着いているので、やることは人間が暗黙に使っている足場をエージェントにも渡すこと。

## 仕組み

### 1 回で決まらない理由

**出力が選ばれ方の問題である。** モデルは次のトークンを分布から選ぶので、同じ入力でも回ごとに違う経路を通る。
加えてエージェントの実行では入力そのものが毎回違う。ツールの結果、リポジトリの状態、時刻、読み込む順序が前の回と同じにならないためで、
「同じプロンプト」であっても「同じ入力」ではない。再現しないのは異常ではなく既定の挙動。

**指示は要求であって保証ではない。** Claude Code の公式ドキュメントは、CLAUDE.md や skill に書いた文について
"a request, not a guarantee" と言い切っている (Security guidance)。
文言を強くしても従う確率が上がるだけで、外れる回は残る。
[context が伸びるほど指示が効かなくなる](../model/attention-dilutes-as-context-grows.md)ので、長い作業ほど後半の回で確率が下がる。

**確率を 1 と仮定した設計だけが壊れる。** 成功率 p が 0.9 でも、検査が無ければ 10 回に 1 回は誤りがそのまま下流に流れる。
壊れるのは p が低いからではなく、p を 1 として組んだ場所があるから。
「1 回で正解」を前提にすると、その仮定が設計のあちこちに暗黙に入り込む。

### 従来のシステムと完成の仕方が違う

決定的なソフトウェアの開発は「設計する → 設計した通りに実装する → 目的の挙動をしたら完了」で進む。
プログラムは同じ入力に同じ出力を返すので、**1 回動いたことを確かめれば以後も動く**。
ここでは設計の精度がそのまま出力の正しさになり、外れたら原因を特定して直せば再発しない。

この形をそのまま持ち込むと「**完璧に設計すればエージェントも 1 回で完璧な出力を出すはずだ**」という読みになる。
これが一番よくある思い込みで、成り立たない。エージェントに渡した設計は実行を一意に決める仕様ではなく、
出力の分布を寄せる入力の 1 つでしかない。設計を詰めれば外れる回は減るが、0 にはならない。

| | 従来のシステム | エージェント |
|---|---|---|
| 設計の効き方 | 実装と挙動を一意に決める | 出力の分布を寄せるだけ |
| 同じ入力への出力 | 常に同じ | 回ごとに違いうる |
| 動作確認の意味 | 1 回動けば以後も動く | その回が動いたことしか言えない |
| 不具合の直し方 | 原因を直せば再発しない | 確率を下げるだけ。検査は残し続ける |
| 完了の位置 | 設計を満たした実装ができたとき | 設計を満たす回を選び取れる形になったとき |

**設計を軽くしてよい話ではない。** ツール、権限、上限値、エスカレーションの発火条件は決定的に書けるので、
そこは従来通り設計で決め切る ([決定的な部分を先に書き切る](requirements-for-agent-as-the-target.md))。
変わるのは最後の 1 歩の意味だけで、「動いたので完了」が「今回は動いた」に落ちる。
その差を埋めるのが判定・やり直し・被害限定の 3 つになる。

### 人間の開発も 1 回では書けていない

人間の開発者も、頭の中で完成品を組み立ててから 1 回で正解を打ち込んでいるわけではない。
書いて、動かして、エラーを読んで直す。設計も途中で変わる。
**1 回で正解が出ないのはモデル固有の欠陥ではなく、開発という作業の性質**で、
人間の側では試行錯誤の足場が環境に最初から揃っているので意識に上らないだけ。

足場は、手元で動かせること、エラーが読めること、壊した版を捨てられること、
前に踏んだ地雷を覚えていること、危ないところで手が止まること、の 5 つに分けられる。
エージェントはこれらを暗黙には持たない。渡されるのは指示とツールだけなので、
**人間が無意識に使っている足場を、明示的に渡す形に置き直す**のが枠組みを作るということになる。

| 人間が暗黙に持っているもの | エージェントに渡す形 |
|---|---|
| 手元で動かして確かめる | テストと lint を 1 コマンドで走る形にし、合否を終了コードで返す |
| エラーを読んで直す | 失敗の出力をそのままエージェントに戻す。[無言で成功しないスクリプトにする](../skills/scripts/agent-scripts-must-not-succeed-silently.md) |
| 壊した版を捨てて戻る | 作業を worktree とブランチで隔離し、commit の単位を小さく切る |
| 前に踏んだ地雷を覚えている | 記憶が context にしか無く消えるので、[外したやり方をチケットに残して次の context に渡す](keep-do-not-repeat-list-outside-context.md) |
| 危ないところで手が止まる | [可逆性で権限を分ける](reversibility-decides-who-acts.md)。戻せない操作は人に渡す |

**違うのは記憶の持続だけ。** 人間は失敗の経験が次の日まで残るが、エージェントの学習は context が消えると消える。
だから人間の開発では暗黙でよかった「覚えている」の部分だけは、ファイルやチケットとして外に置く必要がある。
残りの 4 つは、人間向けの開発環境が既に持っているものをエージェントからも使える形にする作業に近い。

### 目標の置き換え

```mermaid
flowchart LR
    P[指示を磨く<br/>p を上げる] --> R[1 回実行]
    R --> C{機械で判定}
    C -- 合 --> K[残す]
    C -- 否 --> U[捨ててやり直す]
    U --> R
    R -.->|外した場合の被害| B[可逆な範囲に限定]
```

前提を変えると、設計で決めることが 3 つになる。

| 決めること | 中身 | 関連 |
|---|---|---|
| どう判定するか | 合否を人の読みではなくテスト・lint・終了コードで決める。判定できない形の依頼を減らす | [完了条件は達成型・収束型・判定型に分ける](three-types-of-completion-conditions.md) / [先に受入テストを書く](acceptance-test-before-agent-implementation.md) |
| やり直しをどれだけ安くするか | 1 回分を小さく切る、worktree で隔離する、外した手を次の context に渡す | [worktree で隔離する](../agents/parallel-agents-isolated-by-worktree.md) / [Do-Not-Repeat 節に残す](keep-do-not-repeat-list-outside-context.md) |
| 外した回の被害をどこで止めるか | 副作用の可逆性で権限を分け、戻せない操作は人に渡す | [線引きは可逆性で決める](reversibility-decides-who-acts.md) |

判定と被害限定は、指示側の文とは別の場所に置く。
片側だけでは守られないという形は[指示側の誘導と出力側の検査を対で置く](pair-steering-with-output-check.md)に書いた通りで、
本項はその一般化にあたる。「なぜ対で置くのか」の答えが「1 回で正解が出ないから」。

## 使いどころ

**効く場面。** 合否を機械で決められる作業 (実装、修正、移植、生成物の更新) で、
やり直しのコストが人の確認より安いもの。ここでは指示を磨くより検査を足す方が結果が安定する。

**判定が人手のものは形を変える。** 設計の良し悪しや要件の充足は機械で判定できないので、
やり直しの安さではなく[人が見る段数を先に決めておく](human-review-levels-per-issue.md)側で受ける。
[敵対的レビューを別コンテキストに切り出す](../agents/adversarial-review-in-isolated-subagent.md)のは、判定を機械に寄せられないときの次善策。

**指示を磨くのをやめる話ではない。** 期待コストは p に反比例するので、p を上げる価値は最後まで残る。
やめるのは「p を 1 にしようとすること」と「1 になった前提で下流を組むこと」の 2 つだけ。
やることは、指示を磨く努力と、外した回を拾う仕組みの**両方**を置くこと。

**間違える前提は雑さの許可証ではない。** 前提を受け入れた結果として増えるのは、検査・小さい単位・記録であって、
確認せずに投げる回数ではない。外した回が安く戻せない場所 (push、外部 API、破壊的操作) では、
回数ではなく権限で受けるのが元の判断。

**要件と仕様の書き方にも波及する。** 作る対象がエージェントなら、
個別の入出力ではなく[分布と失敗モードと前提の破れで書く](requirements-for-agent-as-the-target.md)ことになる。
これも「1 回で正解」を前提にできないことの帰結。

## 確かめていないこと

- **成功率も分散も測っていない。** ここに書いたのは Claude Code 2.1 (VS Code 拡張) を日常的に使った観察であって、実測値ではない。
  p の具体値を根拠にした主張はしていない
- サンプリングの温度など、Claude Code が内部で使う生成パラメータは確認していない。「出力が選ばれる」以上の内部挙動には踏み込んでいない
- Gemini CLI と Antigravity では確かめていない。確率的である点は同じはずだが、ここでは主張しない

## 関連

- [Ralph loop の反復が良い結果に近づくのは、失敗を捨てて成果だけを外に残しているから](ralph-loop-converges-by-ratcheting-progress.md)。本項の前提を受けて「では何回も回せばよいか」に答える側。回数が効く条件を書いている
- [本当に守らせたい内容は指示側の誘導と出力側の検査を対で置かないといけない](pair-steering-with-output-check.md)。判定を置く場所の具体
- [エージェントに任せる操作と人間承認が要る操作の線引きは可逆性で決めるべき](reversibility-decides-who-acts.md)。被害限定の具体
- [context が伸びるほど指示が効かなくなるのは注意が全トークンに配られるから](../model/attention-dilutes-as-context-grows.md)。p が下がる仕組み
- [実装対象がエージェントの要件書は個別の入出力ではなく分布と失敗モードと前提の破れで書くべき](requirements-for-agent-as-the-target.md)。同じ前提を要件書に持ち込んだ形
