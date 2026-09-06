---
type: note
nature: opinion
title: skill が増えたら一覧の切り詰めではなく MCP と同じ検索ツールに寄せられるはず (未検証)
description: >-
  Proposes giving Claude Code skills the same deferred-loading treatment MCP tools already get:
  keep only skill names in context and expose a search tool that returns a skill's full description
  on demand, instead of today's listing that truncates each description at 1,536 characters and
  drops it entirely for least-invoked skills once the 1% context budget overflows. Observes that
  Claude Code already implements the deferral half for skills but offers no retrieval half, so a
  dropped description is unrecoverable within the turn. Flags the main risk: skill triggering is
  subtler than MCP tool selection, so a skill whose description is out of context may never be
  searched for at all. Use when plugin skills crowd the listing, when deciding whether to raise
  skillListingBudgetFraction, or when designing skill discovery for an agent harness. Not for the
  mechanics of the existing truncation itself, and not a shipped feature.
tags: [claude-code, context-management, tool-use]
keywords:
  - skill listing
  - ToolSearch
  - ENABLE_TOOL_SEARCH
  - skillListingBudgetFraction
  - skillListingMaxDescChars
  - tool search
  - deferred tools
  - 遅延読み込み
  - 検索ツール
  - 名前だけ
  - 呼ばれない
  - プラグイン
  - progressive disclosure
  - MCP
  - context 圧迫
status: stable
verified_at: 2026-09-06
stale_after: 2027-03-06
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/skills
  - https://code.claude.com/docs/en/mcp
  - https://code.claude.com/docs/en/settings-reference
  - https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
---

# skill が増えたら一覧の切り詰めではなく MCP と同じ検索ツールに寄せられるはず (未検証)

## 思いつき

Claude Code は MCP ツールと skill で、数が増えたときの扱いが違う。MCP には検索がある。skill には無い。

| | MCP ツール | skill |
|---|---|---|
| 毎ターン context に入るもの | ツール名だけ (tool search 有効時) | 名前 + description + `when_to_use` の一覧 |
| 詳細の取り方 | `ToolSearch` で必要になったときに取る | 取れない。`/<name>` で本体を開くしかない |
| 予算超過時 | 起きない (定義は最初から入っていない) | 呼び出し回数の少ない skill から description を落とす |
| 制御 | `ENABLE_TOOL_SEARCH` | `skillListingBudgetFraction` / `skillListingMaxDescChars` |

skill 側にも同じ形を入れられるはず。名前の索引だけを毎ターン置き、`SkillSearch` のようなツールで description を引かせる。
description が長い skill、プラグイン由来で普段使わない skill ほど得をする。

## なぜ効きそうか

Claude Code は skill について**遅延の半分だけを既に実装している**。予算が溢れたら description を落とすところまではやるが、
落とした description を後から取り戻す手段が無い。落ちた skill は名前しか残らないので、Claude が自分で選ぶ材料が消える。
MCP 側の `ToolSearch` はまさにこの「取り戻す」半分に当たる。足りていないのは仕組みの半分だけで、設計としては新しくない。

description は「今この skill を開くべきか」を判定させるためだけの文なので、本体 (SKILL.md) と同じく必要になってから読めばよい。
一覧に常駐させる理由は「そこに skill があると気付かせる」ことだけで、それは名前でも果たせる場合がある。

## 効かないかもしれない理由

**skill は自分で気付いてもらう必要がある。** MCP ツールは「GitLab の issue を立てて」のようにユーザの発話に対象システムの名前が出るので、
何を検索すればよいかが分かりやすい。skill の起動条件はもっと薄い。「知見を書いて」から `knowledge-add` に辿り着くのは
description の「Use when the user wants to record something learned about agent development」を読んでいるからで、
名前だけからは繋がらない。description を全部外すと、検索そのものが呼ばれずに終わる恐れがある。

**縮退案。** 名前だけにせず、1 skill 1 行のトリガ語だけ残す。長い What / Use when / Not for は検索で引く。
今の切り詰め (先頭 1,536 字を残す) と方向は同じだが、切られた側を取り戻せる点が違う。

## 今できること

仕組みが無い以上、今は予算を空ける側でしか対処できない。

- `/skill-doctor` (v2.1.252 以降) で使っていない skill を見つけて切る。プラグイン由来が予算を食っていることが多い
- description を 1,536 字に収める。手順や規約は本文へ移す
- `skillListingBudgetFraction` を上げるのは最後。上げた分だけ毎ターンの context が減る

## 確かめていないこと

- skill 向けの検索の仕組みが公式に存在しないことは、skills ページに記述が無いことから判断しただけ。実装や未公開の設定は確かめていない
- MCP の tool search が「MCP ツールの定義が context の 10% を超えると自動で有効になる」という記述は二次情報 (ブログと issue) で見た。
  公式ドキュメントで確認できたのは `ENABLE_TOOL_SEARCH` が `true` / `false` を取ること、v2.1.212 以降は既定で有効なことまで。
  `auto` という値と 10% の閾値は未確認
- 名前だけ (またはトリガ語 1 行だけ) にしたとき Claude が実際に検索を呼びに行くかは試していない。ここが提案の成否を決める
- 検索を挟むことで増える往復のコスト (ToolSearch 1 回分の待ちとトークン) を、description を常駐させるコストと比べていない

## 昇格の目安

(.claude/rules/knowledge-authoring.md「note を昇格させる」)。満たしたら type を変える。ファイルは動かさない。

- [ ] 粒度が type の定義に収まっている (concept / how-to / reference / pattern / pitfall)
- [ ] sources に一次情報がある
- [ ] 実際に試して applies_to と verified_at を書ける

## 関連

- [skill の description は 1,536 字で切られ一覧が予算を超えると使っていない skill は名前だけになる](skill-description-cut-by-listing-budget.md)。この提案が解こうとしている症状
- [MCP のツール名はサーバが定義するのでパターンによる種別分類は当たらない](../mcp/mcp-tool-names-are-server-defined.md)。名前だけを索引にするときに効いてくる制約
- [ツール定義の description は 1 行しか見えない](../workflow/tool-description-shows-one-line.md)。ツール側の同じ形の制約
- [context に入るものと入るタイミング](../diagrams/what-enters-context-when.dataflow.html)。skill の一覧と本体が context に入る経路 (ブラウザで開く)
- [skill を足すコストは既存の skill が払うので総数を絞るべき](adding-a-skill-is-paid-by-the-other-skills.md)。検索の仕組みが無い今、予算を空ける側の対処
- [他の skill からしか呼ばれない手順は skill にせず references のファイルに置くべき](caller-only-procedures-belong-in-skill-references.md)。同上
- [context が伸びるほど指示が効かなくなるのは注意が全トークンに配られるから](../model/attention-dilutes-as-context-grows.md)。一覧予算を含む常駐トークンの話がなぜ効くかの根
