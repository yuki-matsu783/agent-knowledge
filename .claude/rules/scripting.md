# スクリプトの言語選択と書き方

Node (TypeScript) と Python (uv) の両方を使う。どちらを選ぶかは好みではなく、**出力先のエコシステム**で決める。

## 選択基準

| 状況 | 言語 | 理由 |
|---|---|---|
| リポジトリ自身の道具 (frontmatter lint、index、search) | TypeScript | Marp と archify で Node は必須なので、同じランタイムに寄せると環境が 1 つ減る。frontmatter の YAML 1.2 の扱いも理由 (後述) |
| Marp、archify など Node 製ツールを呼ぶ | TypeScript | ツール本体が Node。子プロセスで npx を挟まず直接 require / 実行できる |
| xlsx / docx / pptx の生成、Anthropic の document skills を使う | Python | openpyxl、python-pptx、python-docx が事実上の標準。skills 側も Python 前提 |
| 表データの加工、統計、可視化 | Python | pandas、matplotlib が揃っている |
| marpx のように Python 製ツールを呼ぶ | Python | 同上 |
| hook (settings.json や git から呼ぶ小さな処理) | POSIX sh | 20 行以内。それを超えるなら TypeScript か Python に移す。hook 自体はただのシェルコマンドで、Node にも Python にも依存しない |

迷ったら TypeScript。両方で書ける処理を Python で書き直さない。

## 速度について

言語の実行速度は判断材料にしない。このリポジトリのスクリプトは数十〜数百ファイルの読み書きで、**プロセス起動と wrapper のコスト**が実行時間のほぼ全部を占める。Windows (Git Bash) で実測した値 (5 回平均、2026-09-05):

| 起動方法 | 時間 |
|---|---|
| `node --experimental-strip-types -e 0` | 0.6 秒 |
| `.venv/Scripts/python.exe -c pass` | 0.5 秒 |
| `node --import tsx -e 0` | 1.8 秒 |
| `uv run python -c pass` | 2.6 秒 |
| `pnpm exec tsx -e 0` | 3.9 秒 |
| lint 本体 (`node --import tsx scripts/lint-frontmatter.ts`) | 1.7 秒 |
| 同じ lint を `pnpm exec tsx` 経由 | 5.2 秒 |

CPU バウンドの処理なら V8 (Node) が CPython より速いが、そういう処理はこのリポジトリに無い。効くのは次の 2 点。

- **hook から呼ぶときは `pnpm exec` と `uv run` を挟まない。** `node --import tsx scripts/foo.ts` か `.venv/Scripts/python.exe` (Linux は `.venv/bin/python`) を直接呼ぶ。人が手で叩く入口は `pnpm <name>` のままでよい
- Node 22.18 以降または 23.6 以降では `node scripts/foo.ts` がそのまま動く (型注釈の除去が既定で有効)。そうなったら `--import tsx` を外す

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
