---
type: pattern
nature: best-practice
title: エージェントが書く宣言で権限を広げられないようにすべき
description: >-
  A trust-boundary pattern for agent workflows where the agent declares in a ticket what it may write and
  run: the declaration narrows within a ceiling that a human-managed per-type config defines, the guard
  evaluates type deny before the declaration so a declaration can never override a deny, rewriting the
  declaration of an in-progress ticket is itself blocked, undeclared paths get a warning-and-ask rather
  than a hard deny (headless turns ask into deny, so plans must declare fully), and remote writes use the
  same declaration scheme instead of a "no gh/glab except in ticket X" blanket rule. Includes the observed
  case of an executor adding a class to its own declaration. Use when letting an agent state its own scope.
  Not for the hook mechanics that enforce paths.
tags: [claude-code, security, workflow]
keywords: [宣言, allowed_paths, allow.ops, 上限, type 定義, 信頼境界, 特権昇格, deny を覆せない, 判定順, 作業中の宣言書き換え, 警告付き ask, ヘッドレス, リモート書き込み, 宣言体系, 自分で宣言を足した]
status: stable
sources:
  - https://code.claude.com/docs/en/hooks
intervention: hook
---

# エージェントが書く宣言で権限を広げられない

## 課題

作業中のチケットの frontmatter に「そのタスクでやってよいこと」(書き込めるパス、実行できる操作の分類) を書かせ、guard が宣言に無いパスと操作を拒否する。
チケットはエージェント自身が書くので、そこに書いたものをそのまま信頼すると、**エージェントが自分で権限を広げられる**。

実際に起きた。調査の実施チケットが、計画には無い「テストの実行」を自分の宣言に足して 32 本のテストを走らせていた。宣言は上限を絞る役なので通らないはずの形だった。

## 解決

- **宣言は絞るだけ。上限は人が管理する設定 (type ごとの許可パス・禁止パス・操作の分類) が決める。** 「設定は人が管理する (信頼する)、チケットはエージェントが書く (信頼しない)」という信頼境界を判定順に埋め込む:
  type の deny → type の ask → type の allow → 共通の deny → 共通の ask → **チケットの宣言** → 共通の allow → セッションの承認記憶 → 未記載は警告付き ask。
  宣言は deny の後に評価されるので、宣言で deny を覆せない
- **作業中のチケットの type と宣言を書き換える操作は guard が拒否する。** 書き換えられるなら上限の意味が無い
- **未記載のパスは一律拒否にせず警告付き ask。** 計画で列挙し漏れたパスのたびに止まると、ヘッドレスでは回復手段が無い。ask はヘッドレスでは deny に化けるので、計画タスクは宣言を十分に列挙する必要がある、と仕様に書く
- **読むだけの操作と機構自身の状態遷移コマンドは宣言に依らず常に許可する。** 宣言漏れで「ファイルを読む」「完了する」が止まる害の方が大きい ([復旧経路を残す](../common/keep-recovery-path-when-guard-config-breaks.md))
- **リモートへの書き込みも同じ宣言体系で扱う。** 当初は「全体計画チケット以外の作業中は gh / glab と push を禁止」という特定チケット基準の全面ルールだったが、リモート書き込みが要るタスクを足すたびに例外がつぎはぎになった。
  統制したいのは「統制外の外部への副作用」であって「特定チケット以外の CLI」ではない。読み取りは常時可、書き込みは「タスクの切れ目の処理」か「作業中チケットの宣言にある操作 (type の上限内)」だけ
- 実行しない予定の分類 (テスト実行、外部への問い合わせ) は上限に含めても既定で使えない。計画が宣言したときだけ通る。「宣言があれば実行を意図したことが機械可読になり、実施側が勝手に範囲を広げられない」

レビュアーはチケットを読むだけで「この作業で何が触られうるか」を確認できる。宣言をチケットに書かせる利点はここにある。

## 適用条件

- 効く: チケット・計画をエージェントが書き、guard が機械的に強制する構成
- 効かない: 宣言だけで判定する (type 定義を持たない) 案。設定が 1 か所で済むが、エージェントが宣言を書く時点で権限が決まるので統制にならない。逆に type 定義だけ (チケットに宣言を書かない) 案は、同じ type のチケットが常に同じ範囲を触れて粒度が粗い

## トレードオフ

- 得る: 自己特権昇格が構造的に起きない。統制の軸が「チケット名」から「操作の分類」に変わり、例外の列挙が消える
- 失う: 計画タスクが宣言を列挙する手間。ヘッドレスでは列挙漏れが即停止になる

## 関連

- [コマンドが約束する保証はコミット済みの版を自分で読んで担保する](../../workflow/enforce-guarantee-by-reading-committed-version.md)。エージェントの書き込みを信頼しない同じ構図
- [削除は保護 glob が対象で始まるかで判定し配下を列挙しない](judge-deletes-by-protected-glob-prefix.md)。宣言に明示された対象だけ通す判定の例
- [エージェントに任せる操作と人間承認が要る操作の線引きは可逆性で決める](../../workflow/reversibility-decides-who-acts.md)。リモート書き込みのうち何を人に残すか
