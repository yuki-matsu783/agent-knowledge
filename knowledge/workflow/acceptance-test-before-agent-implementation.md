---
type: note
nature: opinion
title: エージェントに実装させる前に外から観測できる受入テストを書くとよいはず
description: >-
  Idea for driving agent-written implementation work: before letting the agent write any
  implementation, write the acceptance tests — the conditions observable from outside the tool — and
  keep one of them runnable as a single command so that "done" becomes a mechanically checkable
  achievement condition instead of the agent's own reading of its work. Splits abnormal cases into
  requirement-derived ones (an EARS unwanted-behaviour statement, writable before any code exists)
  and implementation-derived ones (exception types, retry points, writable only once the internal
  structure is fixed), and argues that only the former belong in the first pass. Use when handing an
  implementation task to Claude Code or a subagent and deciding what to write first. Not for choosing
  a test framework, not for unit-level TDD inside a settled design, and not measured against a
  session that wrote its tests afterwards.
tags: [claude-code, evaluation, workflow]
keywords: [受入テスト, acceptance test, ATDD, スモークテスト, smoke test, ハッピーパス, テストを先に書く, TDD, EARS, 望ましくない挙動, 要求由来の異常系, 実装由来の異常系, 完了条件, 達成型, 終了コード, 出力側の検査, ゴールハック, テストを書き換える, インタフェース設計]
status: stable
sources: []
---

# エージェントに実装させる前に外から観測できる受入テストを書くとよいはず

## 思いつき

エージェントに実装させると、終わったかどうかの判断がエージェント自身の読みになる。
実装が済んでからテストを書かせると、テストが実装に合わせて書かれるので、通っても何も保証しない。

先に**受入テスト**、つまり外から観測できる合格条件を書いてから実装させると、3 つが同時に手に入る。
先に書いて実装を駆動する形には ATDD (Acceptance Test Driven Development) という名前が既に付いている。

1. **完了条件が達成型になる。** 「コマンドが 0 で終わる」は機械で判定できるので、
   [完了条件は達成型・収束型・判定型に分けて達成型だけを Stop hook に置いた方がよさそう](three-types-of-completion-conditions.md) の達成型に落ちる。
   後から書くと「動くように見える」という判定型に流れる
2. **出力側の検査になる。** 「壊すな」「確かめてから終われ」という指示側の文だけでは外れる回が残る。
   [規範は指示側の誘導と出力側の検査を対で置くべき](pair-steering-with-output-check.md) で言う対の、出力側がこれにあたる
3. **結論が機械的に決まる。** 実装の前に合格条件を固定してあるので、落ちたときに「意図した動作です」という後付けの議論が起きない。
   [実測の前に外れたときの縮退が書かれているべき](write-fallback-condition-before-measuring.md) と同じ形を、実装作業に当てたもの

## 最初に書けるものと書けないもの

異常系を 2 つに分けると、初手で何が書けるかが決まる。

- **要求由来の異常系は最初から書ける。** 外から観測できる約束だから。`.claude/rules/scripting.md` の終了コード規約
  (成功は 0、引数不正と処理失敗は 1、該当 0 件は成功) がその例で、実装が 1 行も無くても検証コードにできる
- **実装由来の異常系は書けない。** どこで落ちるか、どんな例外型か、どこにリトライを置くかは内部構造が決まらないと定まらない。
  先に書くとテストが設計を固定してしまい、エージェントが構造を変えた時点でまとめて捨てることになる

だから初手の対象は「正常系」ではなく「外から観測できる条件」。中身はハッピーパスが大半で、要求由来の異常系がいくつか混じる。

このリポジトリは requirement を EARS 形式で書くので (`.claude/rules/repo-docs.md`)、型がそのままテストの形に対応する。

| EARS の型 | テストの形 |
|---|---|
| ユビキタス | どのケースでも確認する不変条件 |
| イベント駆動 | 入力を与えて出力を照合する。ハッピーパスの本体 |
| 状態駆動 | 事前状態を作ってから確認する |
| 望ましくない挙動 | 要求由来の異常系。実装が無くても書ける |
| オプション | 条件を満たす環境でだけ実行する |

requirement に描くハッピーパスの mermaid が通し確認 1 本、個々の EARS の文が assertion 1 個、という対応になる。

## スモークテストとの関係

**スモークテストは受入テストの部分集合。** 受入テストのうち、毎回ゲートとして叩く 1 本を指す。
両者は軸が違う語で、受入テストは「何を根拠に合格とするか」、スモークテストは「いつ何のために走らせるか」を言っている。

区別が効くのは assertion の厚み。スモークは「起動する」「入口が応答する」で足りるので薄くてよい。
受入テストは期待値を照合しないと意味がないので薄くできない。混ぜると、ゲートのつもりのものが仕様変更のたびに壊れる重いテストになる。

単体テストを先に全部書く形にしないのも同じ理由で、エージェントは途中で内部構造を変えるため、内部に密着したテストは維持費が高い。

## 置き方の案

- **入口の名前と入出力の形を先に決める。** テストは呼ぶ対象が無いと書けないので、書く作業がそのままインタフェース設計になる。
  検証よりこちらの効能の方が大きいかもしれない
- 入口は 1 コマンドにする。このリポジトリなら `pnpm <name>` の形。エージェントに「どう動かすか」を毎回考えさせない
- 実装を始める前に、まず落ちることを確かめる。落ちないテストは何も見ていない
- 公開インタフェース越しだけを叩く。内部関数に触った時点で、実装由来の異常系を先に固定したのと同じことになる
- 強制するならスモークの 1 本を Stop hook に達成型として置く。ただし全タスクに置くと重いので、外した実装から対にする

## 確かめていないこと

- 先に書いた場合と後から書いた場合を比べていない。手戻りが減るのか、テストを書く分だけ遅くなるのかが分からない
- **ゴールハックの頻度。** 落ちたときにエージェントが実装ではなくテストの方を書き換えないか。
  起きるならテストファイルを PreToolUse で編集させない側に倒す必要があるが、その必要があるかどうかを見ていない
- 要求由来と実装由来の切り分けが実際にきれいに付くか。EARS で書いていない相手の要求だと、この線引き自体が手作業になる
- 粒度。受入テストを何本書いてから実装に入るか。多いほど「先に書く」コストが跳ねる
- Claude Code の公式 best-practices にある TDD の進め方と突き合わせていない。sources が空なのはこのため
- 確かめる場合の対象は Claude Code 2.1 (VS Code 拡張)。Gemini CLI では考えていない

## 昇格の目安

- [ ] 粒度が type の定義に収まっている (concept / how-to / reference / pattern / pitfall)
- [ ] sources に一次情報がある
- [ ] 実際に試して applies_to と verified_at を書ける
