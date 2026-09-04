# スクリプトの言語選択と書き方

Node (TypeScript) と Python (uv) の両方を使う。どちらを選ぶかは好みではなく、**出力先のエコシステム**で決める。

## 選択基準

| 状況 | 言語 | 理由 |
|---|---|---|
| リポジトリ自身の道具 (frontmatter lint、index、search、hook から呼ぶもの) | TypeScript | Claude Code の hook と同じ Node 環境で動き、依存が pnpm 一本で済む |
| Marp、archify など Node 製ツールを呼ぶ | TypeScript | ツール本体が Node。子プロセスで npx を挟まず直接 require / 実行できる |
| xlsx / docx / pptx の生成、Anthropic の document skills を使う | Python | openpyxl、python-pptx、python-docx が事実上の標準。skills 側も Python 前提 |
| 表データの加工、統計、可視化 | Python | pandas、matplotlib が揃っている |
| marpx のように Python 製ツールを呼ぶ | Python | 同上 |
| hook (settings.json から呼ぶ小さな処理) | POSIX sh | 20 行以内。それを超えるなら TypeScript に移す |

迷ったら TypeScript。両方で書ける処理を Python で書き直さない。

YAML はどちらでも扱える。ただし frontmatter は Node の `yaml` パッケージ (YAML 1.2) で読むと `2026-09-05` や `on` が文字列のまま残り、PyYAML (YAML 1.1) だと日付や真偽値に勝手に変換される。frontmatter を触る処理は TypeScript 側に寄せてこの差を持ち込まない。Python で YAML を読む必要が出たら `ruamel.yaml` を使う。

## 配置と入口

```
scripts/*.ts            # TypeScript。tsx で実行
scripts/lib/*.ts        # 共通処理
scripts/<domain>/*.py   # Python。ドメインごとにディレクトリ (例 scripts/xlsx/)
.claude/hooks/*.sh      # hook 専用の sh
```

- 入口は必ず package.json の `scripts` に登録し、`pnpm <name>` で呼べるようにする。Python も `"xlsx": "uv run python scripts/xlsx/tables_to_xlsx.py"` のように pnpm 経由にする。呼び方を 1 つにするため
- 環境構築は `pnpm install` と `uv sync` の 2 コマンドで完了すること。ロックファイル (pnpm-lock.yaml、uv.lock) はコミットする。`.venv/` と `node_modules/` はコミットしない
- Python のバージョンは pyproject.toml の `requires-python` が正。uv が管理するので、システムの Python に依存しない

## 共通の書き方

- Windows (Git Bash) と Linux の両方で動くこと。パスは `/` に正規化し、`path.join` / `pathlib` を使う。シェル固有の書き方をしない
- ログは stderr、データは stdout。機械が読む出力には `--json` を用意する
- 終了コード: 0 = 成功、1 = 引数不正か処理失敗。「該当 0 件」は成功 (0) にする
- 生成物を書くときは一時ファイル + rename で原子的に差し替え、内容が同じなら書き換えない
- 第三者コードの外部通信 (更新チェック等) は環境変数で止める
- 冒頭コメントに「何をするか」「使い方」「設計上の注意」を書く。仕様書は別に作らない

## 品質

| 言語 | 型・静的検査 | 実行 |
|---|---|---|
| TypeScript | `pnpm typecheck` (tsc --noEmit、strict) | `pnpm <name>` |
| Python | `pnpm lint:py` (ruff check + ruff format --check) | `pnpm <name>` |

新しいスクリプトを足したら、README のコマンド表に 1 行足す。
