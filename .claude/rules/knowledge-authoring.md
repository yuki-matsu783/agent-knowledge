---
paths:
  - "knowledge/**/*.md"
  - "inbox/**/*.md"
  - "adr/**/*.md"
---

# 知識ファイルの書き方

## 言語

本文は日本語。コード、コマンド、製品名、設定キーは英語のまま書く。見出しの語は同じ type の中で揃える (テンプレートの見出しを使う)。

## 何を書かないか

- 業務由来の知見は書かない。顧客名・社内固有名詞・案件の内容はこのリポジトリに入れない
- このリポジトリ自身の道具 (skill・スクリプト・pnpm コマンド) の説明は書かない。要件は `.claude/docs/00_requirement/`、仕様は `.claude/docs/10_spec/` に置く
- 出典で裏付けできない推測を verified にしない。推測は draft のまま inbox/ に置く

## 粒度 (type 別)

| type | 粒度 | 目安 |
|---|---|---|
| concept | 1 つの概念・仕組み | 400 行まで |
| reference | 1 つの対象 (API・設定・CLI) の一覧 | 400 行まで |
| how-to | 1 つの目的に対する 1 手順 | 150 行まで |
| pattern | 1 つの課題と 1 つの解決 | 150 行まで |
| pitfall | 1 つの症状と原因と回避策 | 150 行まで |
| adr | 1 つの決定 | 200 行まで |
| note | 自由 | 200 行まで |

タイトルが「〜と〜」で繋がるなら分割する。目安を超えると lint が warning を出す。

## 鮮度のライフサイクル

```
draft ──(出典を揃えて検証)──> verified ──(新しい知識で置き換え)──> outdated
  ^                              |
  └──────(再検証で古いと判明)──────┘
```

- **draft**: 書きかけ、または未検証。inbox/ の note は常に draft
- **verified**: `verified_at` の日に `applies_to` のバージョンで確認した。`sources` が 1 件以上ある
- **outdated**: 無効化された。ファイルは削除せず残し、`superseded_by` に無効化した側の ID を書く。本文冒頭に「この知識は superseded_by の知識により無効」と 1 行加える

再検証したら本文を直し `verified_at` を更新する。変更の経緯は git が持つので本文に履歴は書かない。

## inbox から knowledge への昇格条件

以下が揃ったら knowledge/ に移して status を verified にする。

1. type が note 以外に決まっている
2. `sources` に一次情報 (公式ドキュメント、リポジトリ、仕様) が 1 件以上ある
3. `applies_to` に検証したバージョンがある
4. tags が taxonomy.yml の語彙で 2〜4 個ついている
5. 実際に試して `verified_at` を書ける

## 出典

- `sources` は一次情報を優先する。ブログ記事は補助にとどめ、公式ドキュメントも併記する
- 本文中で引用するときは、どの source の内容かを分かるように書く

## 図

- 単純な図 (状態遷移、簡単なフロー、5 ノード程度の構成) は本文内の mermaid コードブロックで書く。GitHub でそのまま描画される
- 複雑な構成図 (コンポーネント 8 個以上、境界や主要経路を示すもの、シーケンス、データフロー) は archify skill (.claude/skills/archify、プロジェクトローカルにインストール済み) で型付き JSON から生成する。JSON は `knowledge/diagrams/<slug>.<kind>.json`、出力 HTML は同じ場所に `<slug>.<kind>.html` として置き、本文から相対パスでリンクする
- archify の JSON は白紙から書かない。templates/archify/ の検証済みテンプレート (単体エージェント、マルチエージェント、API ツールループ、MCP、RAG、リトライ状態遷移、評価とリリース) から一番近いものをコピーし、ラベルとカードを差し替える。手順は templates/archify/README.md。`pnpm diagrams --check` で showcase 検証を通してから HTML を生成する
- archify はグローバルではなくこのリポジトリの .claude/skills/ にある版を使う。更新通知の通信は settings.json の `ARCHIFY_UPDATE_CHECK_DISABLED=1` で止めている

## 関連付け

- 関連する knowledge には相対パスでリンクする (pattern から pitfall へ、how-to から concept へ)
- 既存の知識を上書きするときは、新しいファイルを作り、古い方を outdated にして `superseded_by` を書く。上書き編集で古い知識を消さない
