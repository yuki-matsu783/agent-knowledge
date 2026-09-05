# ディレクトリ体系・命名・リンク規約

## ディレクトリ

```
knowledge/     # 知識はすべてここ。主題ディレクトリ (taxonomy.yml の subjects) の直下に置く。knowledge/ 直下には置かない
slides/        # Marp 形式の markdown (type: slide) と生成した HTML
templates/     # 各 type の雛形と Marp テーマ
scripts/       # lint・index・slides・audit (TypeScript、tsx で実行、pnpm)
wip/           # セッション中の作業ファイル。tickets/ だけコミットし、それ以外は追跡しない
logs/          # hook とスクリプトが自分のために残す記録 (判定ログ、カウンタ、状態)。追跡しない
taxonomy.yml   # type と tags の統制語彙
INDEX.md       # 自動生成の一覧。手で編集しない
.claude/rules  # 規約 (常時読み込み)
.claude/skills # 作業手順 (knowledge-add / slide-make / knowledge-audit / commit)
.claude/docs   # このリポジトリの道具の説明。00_requirement (要件) と 10_spec (仕様)
```

## knowledge/ と .claude/docs/ の振り分け

| 書くもの | 置き場所 |
|---|---|
| 他のリポジトリでも通用するエージェント開発の知見 | knowledge/ |
| このリポジトリの道具 (skill・スクリプト・pnpm コマンド) の要件と仕様 | .claude/docs/ |

道具の説明は knowledge に混ぜない。knowledge は「学んだこと」、.claude/docs は「この repo がどう動くか」。

- `00_requirement/<slug>.md` — **外から観測できることだけ**を EARS 形式で書き、ハッピーパスを mermaid で描く
- `10_spec/<slug>.md` — 外部インタフェースに加えて内部の挙動と設計判断を書く
- 書き方の規約は [repo-docs.md](repo-docs.md)。requirement に内部の記述を混ぜないこと

## knowledge/ の主題ディレクトリ

knowledge の markdown は `knowledge/<subject>/<slug>.md` に置く。直下には置かない (lint が error にする)。
subject の一覧と説明は taxonomy.yml の `subjects` が正。「何についての知見か」をエージェントの構成要素で切る。

| subject | 入るもの |
|---|---|
| `skill` | skill・コマンド・エージェントが呼ぶスクリプトの設計 |
| `agent` | サブエージェント、並列化、役割分担、worktree による隔離 |
| `rule` | Claude Code の rules そのもの。CLAUDE.md・.claude/rules・memory の書き方、効き方、限界 |
| `hook` | hook の機構 (イベント、入出力、並列、タイムアウト、登録) とガード hook・permissions による制御 |
| `mcp` | MCP サーバーとツール名、ツール定義の見え方 |
| `model` | モデル挙動。構成要素に依らないモデルの傾向 |
| `workflow` | 複数の構成要素の組み合わせ、運用手順、決定記録と仕様の置き方、git と VCS ホスティング、transcript の観測、未解決の finding |

- 1 つの知見は 1 つの subject に置く。迷ったら「その知見を活かすとき何を書き換えるか」で決める (hook スクリプトなら hook、CLAUDE.md なら rule)。どれにも収まらない組み合わせは workflow
- 横断的な分類 (security、cost、observability など) は tags が担う。subject と tags が重なってもよい
- 新しい subject は候補が 5 件以上溜まってから taxonomy.yml に足す。1 つの subject が 30 件を超えたら小主題で切るか subject を分ける
- ディレクトリ名は ID の一部になる。ファイルを移すときは本文のリンク、sources のパス、superseded_by と derived_from を合わせて更新する (lint が検出する)。subject は増やしても改名しない
- `knowledge/diagrams/` は subject ではなく archify の図の置き場

## wip/ と logs/ の分け方

セッション中にローカルで完結するものは `/tmp` やリポジトリ外の一時ディレクトリではなくリポジトリ内に置く。
外に置くと消し忘れと引き継ぎ漏れが起きるため。置き場所は「人の作業の途中物」か「機構が自分のために残す記録」かで分ける。

| 置き場所 | 中身 | git |
|---|---|---|
| `wip/tickets/` | 作業中チケットの情報 (要件メモ、調査ログ、TODO) | コミットする |
| `wip/local/` | 作業の途中物 (下書き、スクリプトの中間出力)。チケットが終わったら消す | 追跡しない |
| `logs/` | hook とスクリプトが自分のために残す記録 (判定ログ、実行ログ、カウンタ、フラグ、状態ファイル)。チケットをまたいで残る | 追跡しない |

- `.gitignore` は `wip/*` で全部無視し `!wip/tickets/` だけ戻す。`logs/` は丸ごと無視する。既定が「push しない」側なので、
  ログを取り違えてコミットすることがない
- `wip/local/` と `logs/` はコミットされないので clone 直後には存在しない。書く側が `mkdir -p` してから書く
- `logs/` の中は書き手ごとにファイルを分け (`logs/<hook 名または script 名>.jsonl`)、1 行 1 件の JSON Lines で追記する。
  絶対パスやコマンド全文が入るので、ここ以外 (特に `wip/tickets/`) に書かない
- `logs/` は放っておくと増える。書き手が行数か日数で切る (ローテーションは書く側の責任。共通の掃除役は置かない)
- `wip/local/` はチケットの片付けで空にしてよい場所、`logs/` は片付けの対象外。この区別があるので混ぜない
- `wip/` と `logs/` は lint と index の対象外 (scripts/lib/repo.ts の `SCOPE_DIRS` は knowledge / slides)。frontmatter は要らない
- チケットが終わったら `wip/tickets/` の中身を消すか、残す価値があるなら knowledge へ移す

## ファイル名

- ASCII の kebab-case のみ (`^[a-z0-9]+(-[a-z0-9]+)*\.md$`)。日本語ファイル名は使わない
- 日本語の名前は frontmatter の `title` に書く
- ファイル名は内容を表す名詞句にする。日付 prefix は付けない (日付は git が持つ)

## ID

ID = リポジトリルートからの相対パスから `.md` を除いたもの。`superseded_by` と `derived_from` はこの ID で参照する。
参照先は scope 内 (knowledge / slides) でも `.claude/docs/` でもよい。lint はファイルの実在を見る。
ファイルを移動・改名すると ID が変わるので、参照元を必ず更新する (lint が検出する)。

## リンク

- 本文内の相互リンクは相対パスの markdown リンクのみ (同じ subject なら `[title](foo.md)`、別の subject なら `[title](../rule/foo.md)`)
- wikilink `[[...]]` とルート絶対パス `/knowledge/foo.md` は使わない (lint が error にする)
- リンク先の存在は lint が検査する

## 生成物

| ファイル | 生成元 | git |
|---|---|---|
| `INDEX.md` | `pnpm index` | コミットする |
| `<dir>/index.jsonl` | `pnpm index` (SessionStart hook でも再生成) | gitignore |
| `INDEX.md` の自動ステージ | `.githooks/pre-commit` (Claude Code からの commit のときだけ。手動 commit では `pnpm index` を先に実行する) | コミットする |
| `slides/*.html` | `pnpm slides` | コミットする (成果物として共有するため) |
| `knowledge/diagrams/*.html` | `pnpm diagrams` | コミットする (knowledge からリンクされる成果物) |
| `templates/archify/preview/*.html` | `pnpm diagrams` | gitignore (1 本 700KB。テンプレートの確認用) |
| `*.xlsx` | `pnpm xlsx` | 共有する成果物だけコミットする |
