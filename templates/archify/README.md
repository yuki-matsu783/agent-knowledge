# archify テンプレート

エージェント開発でよく出る構成を、archify の showcase 検証 (9 チェック、error 0、warning 0) を通した状態で置いている。
複雑な図を書くときは、白紙から JSON を書かず、ここから一番近いものをコピーして ID・ラベル・カードだけ差し替える。
ジオメトリ (pos / via / y / col) は検証済みなので、ノード数を変えないかぎり触らなくてよい。

## パターン一覧

| ファイル | 図種 | 表しているもの | 使う場面 |
|---|---|---|---|
| `single-agent-tool-loop.architecture.json` | architecture | 1 エージェントの model ↔ tool ループ、権限ゲート、コンテキストとトレース | Claude Code や Agent SDK の単体構成を説明する |
| `multi-agent-orchestration.architecture.json` | architecture | リード + ワーカー + レビュアー、タスクキュー、共有メモリ | サブエージェント構成、並列委譲、品質ゲートを説明する |
| `api-tool-call-loop.sequence.json` | sequence | Messages API の tool_use → 実行 → tool_result → end_turn | API レベルのツール呼び出しループを時系列で示す |
| `mcp-client-server.sequence.json` | sequence | initialize → tools/list → tools/call → 結果 | MCP の責務分担と境界を示す |
| `rag-pipeline.dataflow.json` | dataflow | 取り込み・埋め込み・検索・プロンプト組み立て・生成、アクセス制御 | RAG や検索拡張の構成、データの流れと権限境界 |
| `tool-call-retry.lifecycle.json` | lifecycle | 1 回のツール呼び出しの状態遷移、承認待ち、レート制限、リトライ、終端 | リトライ設計、承認フロー、失敗の分類 |
| `prompt-eval-release.workflow.json` | workflow (v2) | プロンプト変更 → 自動評価 → 判定 → 人手レビュー → リリース、退行時の差し戻し | 評価パイプライン、リリースゲート、CI との統合 |

`preview/` に各テンプレートの生成 HTML ができる (1 本約 700KB なので gitignore。無ければ `pnpm diagrams` で生成する)。ブラウザで開いて形を確かめてから選ぶ。

## 使い方

1. コピーする。出力先は `knowledge/diagrams/<slug>.<kind>.json` (kind はファイル名の末尾で判定する)。

   ```sh
   cp templates/archify/single-agent-tool-loop.architecture.json knowledge/diagrams/my-agent.architecture.json
   ```

2. `meta.title`、各ノードの `label` / `sublabel` / `tag`、`cards`、`meta.views` の note を差し替える。ID は変えてもよいが、`views.focus` と `from` / `to` と `mainPath` を合わせて変える。

3. ノードを増減した場合だけ座標を触る。1 つ変えるごとに検証する。

   ```sh
   pnpm diagrams --check knowledge/diagrams/my-agent.architecture.json
   ```

   診断は `subject` と `supportedFixes` を読んで、指摘された 1 箇所だけ直す。2 回直して改善しなければ、ノードを減らす方が早い。

4. HTML を生成する。

   ```sh
   pnpm diagrams knowledge/diagrams/my-agent.architecture.json
   ```

   `knowledge/diagrams/my-agent.architecture.html` ができる。knowledge の本文からは相対パスでリンクする。

## テンプレートを追加するとき

- ファイル名は `<pattern>.<kind>.json`。pattern は kebab-case
- `pnpm diagrams --check` で showcase を通してから置く。preview も `pnpm diagrams` で再生成する
- この表に 1 行足す。「使う場面」が既存と重なるなら追加しない

## 書き方の指針 (archify SKILL.md より)

- 主経路は 1 本。枝は最寄りの主経路ノードから出す
- ノードは 12 個まで。細部はエッジを増やさず `cards` に書く
- ラベルは意味を持つデータ。衝突したら位置を動かし、削らない
- `meta.visual_preset` と `meta.subtitle` は省略する (既定の classic で開く)
- 日本語ラベルは書ける。Viewer の UI は英語のまま
