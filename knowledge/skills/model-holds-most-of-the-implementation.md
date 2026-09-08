---
type: concept
nature: insight
title: AI の設計書が skill 記述より量が多くなるのは、実装の大半をモデルが持っているから
description: >-
  Explains why the usual size relation between a design document and its implementation inverts for
  agents. In ordinary software the implementation (shared libraries plus application code) far
  outweighs the design document, because a general-purpose library never reaches the domain and the
  remainder has to be written out. For a Claude Code skill the written implementation is smaller than
  the design document, because the general half already sits in the model's weights and only the
  project-specific difference is left to write, while the design document does not shrink at all.
  Use when sizing a skill, a command, or CLAUDE.md against its design document, when a short skill
  file feels like an unfinished implementation, or when a skill grows longer than the document it
  came from. Not a measured ratio, not advice on where to store design documents, and not applicable
  to scripts or MCP servers, whose code the model does not supply.
tags: [claude-code, prompting, workflow]
keywords:
  - 設計書
  - 実装量
  - 量の比率
  - 逆転
  - 共通ライブラリ
  - 汎用性
  - モデルの重み
  - 事前学習
  - 差分だけ書く
  - skill
  - SKILL.md
  - 500 行
  - 記述量
  - 見積もり
  - モデル更新
status: stable
applies_to: [claude-code@2.1]
sources:
  - https://code.claude.com/docs/en/skills
---

# AI の設計書が skill 記述より量が多くなるのは、実装の大半をモデルが持っているから

## 要点

通常の開発では 設計書 < 実装 になる。Claude Code の skill では逆で 設計書 > skill 記述 になる。
実装の総量は「モデルが既に持っている知識 + 書いた文」で、その大半をモデルが占めるため、書く側に残るのは差分だけになるから。

## 仕組み

実装の総量を「汎用の部分」と「自分で書く部分」に分けると、両者の違いは汎用の部分をどこが持つかにある。

| | 汎用の部分を持つもの | 自分で書く部分 | 設計書との量の関係 |
|---|---|---|---|
| 通常の開発 | 共通ライブラリ | ソースコード | 設計書 < 実装 |
| エージェント | モデルの重みに入っている知識 | skill・CLAUDE.md・プロンプト | 設計書 > 記述 |

通常の開発でライブラリが実装量を減らしきれないのは、**ライブラリの汎用性がドメインに届かないから**。
汎用のライブラリはドメイン固有の判断を代わりにやってくれないので、残りは全部ソースコードに書くことになる。
共通ライブラリとソースコードを合わせれば設計書より多く、ソースコードだけでも設計書より多い。

モデルはここが違う。git の使い方、テストの書き方、markdown の整形、よくある設計パターンのような汎用の手続きを、
書かなくても既に持っている。skill に書くのは、モデルが持っていない差分 — このリポジトリ固有の置き場所、語彙、判断基準 — だけになる。
公式ドキュメントが SKILL.md を 500 行以内に収めろと言い、どうやるか・なぜかを語らず何をするかを書けと言うのは、
書く対象がこの差分しかないため。

設計書の側は減らない。何を作るか、なぜそう決めたか、外から見てどう振る舞うべきかは、モデルの中には入っていない。
むしろ相手が非決定なぶん失敗モードと検知を書き足す必要があって膨らむ
([実装対象がエージェントの要件書は個別の入出力ではなく分布と失敗モードと前提の破れで書くべき](../workflow/requirements-for-agent-as-the-target.md))。
設計書はそのままで、書く実装だけが縮む。だから比が逆転する。

## 使いどころ

- **skill が設計書より短いことを実装漏れの兆候と読まない。** 見るのは量ではなく、モデルが持っていない差分を書き切れているか
- **逆に skill が設計書より長くなったら疑う。** モデルが既に知っていることを書き写している可能性が高い。
  書いた分は毎ターン context に残り続けるコストになる ([skill を足すコストは既存の skill が払うので総数を絞るべき](adding-a-skill-is-paid-by-the-other-skills.md))
- **工数の見積もりには使わない。** 書く量が減っても、設計書を書く手間と、非決定な出力を確かめる手間は減らない
- **比はモデルが変わると動く。** モデルが賢くなるほど差分は縮み、記述はさらに短くなる。今のモデルの穴を埋めるために書いた行は次のモデルでは要らなくなる
  ([CLAUDE.md は最小から始めモデルが外したときだけ足すのがよいはず](../rules/claude-md-starts-minimal-and-grows-only-on-misses.md))
- **効かない場面**: スクリプトと MCP サーバーはモデルが実行時に肩代わりしてくれない。skill から呼ぶ TypeScript や Python は通常の 設計書 < 実装 のまま

## 関連

- [skill を足すコストは既存の skill が払うので総数を絞るべき](adding-a-skill-is-paid-by-the-other-skills.md)
- [他の skill からしか呼ばれない手順は skill にせず references のファイルに置くべき](caller-only-procedures-belong-in-skill-references.md)
- [CLAUDE.md は最小から始めモデルが外したときだけ足すのがよいはず](../rules/claude-md-starts-minimal-and-grows-only-on-misses.md)
- [実装対象がエージェントの要件書は個別の入出力ではなく分布と失敗モードと前提の破れで書くべき](../workflow/requirements-for-agent-as-the-target.md)
