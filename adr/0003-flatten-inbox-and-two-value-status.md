---
type: adr
title: inbox/ を廃止し status を stable / deprecated の 2 値にする
description: >-
  Records the decision to delete the inbox/ directory, keep every knowledge file under knowledge/, and
  collapse the status vocabulary from draft / verified / outdated to stable / deprecated, so that how
  well something was checked is carried by `type` and by the body rather than by a directory and a
  lifecycle flag. Use when deciding where to put an unverified note, when wondering why `note` now
  lives in knowledge/, or before proposing another status value. Not for the writing procedure itself,
  which lives in the skills, and not a change to superseded_by, which still marks replacement.
tags: [meta, workflow]
keywords: [inbox, 廃止, status, stable, deprecated, draft, verified, outdated, note, 昇格, OKF, 語彙, ディレクトリ, 鮮度, lint]
status: stable
verified_at: 2026-09-05
sources:
  - https://okf.md/spec/
  - adr/0001-repository-conventions.md
---

# inbox/ を廃止し status を stable / deprecated の 2 値にする

## 状況

[0001](0001-repository-conventions.md) では、未整理のメモを `inbox/` に置き、検証が済んだものだけを
`knowledge/` に昇格させる二段構えにした。status も `draft` → `verified` → `outdated` の 3 値で、
`verified` にするには sources と applies_to と実際に試した記録が要る決まりだった。

運用してみると、この二段構えが記録を止める側に働いた。

- 昇格条件を満たさない限り知識は inbox/ に留まる。実際、昇格した note は 1 件も無かった
- 検索も INDEX も 2 つのディレクトリに割れる。「どこかに書いたはず」のとき 2 か所を見ることになる
- `draft` と `verified` の差は本人にしか意味が無い。他人 (と将来の自分) が読むときに効くのは
  「何が確かめてあって何が確かめていないか」という本文の記述であって、frontmatter の 1 語ではない
- そもそもここは検証を通す場ではなく知識を貯める場。出典が無いという理由で書くのをためらう方が損

`status` は OKF の必須項目ではない。v0.1 に定義は無く、v0.2 で任意項目として入ったが
「open vocabulary」と明記されていて、挙がっているのは `draft | stable | deprecated` という例示だけ。
3 値の語彙は最初からこのリポジトリの独自定義であって、OKF に合わせる義務は無かった。

## 決定

| 項目 | 決定 |
|---|---|
| ディレクトリ | `inbox/` を廃止する。知識はすべて `knowledge/` 直下に置く。`SCOPE_DIRS` は knowledge / adr / slides |
| status | `stable` / `deprecated` の 2 値。書いた時点で `stable`、置き換わったら `deprecated`。OKF v0.2 の例示語彙に合わせる |
| 確かめた度合い | status ではなく `type` が持つ。未確認のものは `type: note` にし、本文に何が未確認かを書く |
| note の置き場所 | `knowledge/`。`note` は「まだ確かめていない」印であって置き場所ではない |
| 昇格 | type を `note` から `concept` / `how-to` / `reference` / `pattern` / `pitfall` に変えるだけ。ファイルは動かさないので ID が変わらず、リンクも壊れない |
| verified_at / applies_to / sources | すべて任意。無くても error にしない。knowledge/ で sources が無いときだけ warning |
| superseded_by | 変更なし。`deprecated` のとき必須 |
| 既存の outdated 2 件 | 削除した。`.claude/docs/` の spec に完全に移っていて、参照元も無かった |

## 効果

- 「どこに書くか」の判断が消える。`knowledge/` しか無い
- 昇格でファイルが動かないので ID が安定する。0001 が「ID を変えると参照が壊れる」と書いた懸念が、
  昇格の経路からも消えた
- lint が error にする条件が減り、warning に寄る。書き始めるコストが下がる
- `pnpm audit` の役目が変わる。draft の滞留を探す代わりに、verified_at の古さ・applies_to 欠け・
  sources 欠けを挙げる

## 却下した案

| 案 | 却下した理由 |
|---|---|
| status を廃止する | `deprecated` を表す手段が無くなる。置き換えの記録は 0001 の判断どおり残したい |
| `draft` だけ残して `verified` を廃止 | 「未検証」を表す語が status と type の両方にできて二重になる |
| `active` / `outdated` | 意味は同じだが OKF v0.2 の例示から外れる。合わせられる場面で独自語にする理由が無い |
| inbox/ を残して note も knowledge/ に置ける形にする | 置き場所の判断が毎回発生する。二段構えをやめる目的に反する |
| `stale_after` (OKF v0.2) を導入 | 期限をファイルごとに決める運用が重い。`verified_at` + `pnpm audit --days` で足りる |

## 残っている歪み

`verified` が語彙から消えたのに `verified_at` という名前が残っている。
`checked_at` などへの改名は参照箇所が広いので、必要になった時点で別の ADR にする。
