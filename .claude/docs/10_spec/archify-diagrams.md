---
type: spec
title: 構成図生成 (archify) の仕様
description: >-
  Full specification of this repository's diagram pipeline: the pnpm diagrams command line, how the
  build script discovers targets and derives the diagram kind from the filename, what it passes to
  the project-local archify binary, how it interprets the JSON result and exit code, and the
  coordinate limits each diagram kind enforces. Use when creating, fixing, or modifying diagram
  generation here. Not for deciding whether a diagram needs archify at all (see the requirement).
status: stable
verified_at: 2026-09-05
applies_to: [archify@2.17.0-dev.1, node@22.15]
sources:
  - https://github.com/tt-a1i/archify
  - ../../../scripts/build-diagrams.ts
  - ../../../templates/archify/README.md
---

# 構成図生成 (archify) の仕様

要件と適用範囲は [00_requirement/archify-diagrams.md](../00_requirement/archify-diagrams.md) にある。

## 前提

- archify はプロジェクトローカルの `.claude/skills/archify` にある (グローバルインストールしない)。無ければ以下で複製する

  ```sh
  pnpm dlx skills add tt-a1i/archify --skill archify --agent claude-code --copy --yes
  ```

  `skills-lock.json` がリポジトリ直下に生成される (skills CLI のロックファイル)。

- `node .claude/skills/archify/bin/archify.mjs doctor` が全項目 ok を返すこと

## 外部インタフェース

```sh
pnpm diagrams [--check] [<file.json> ...]
```

| 引数 | 意味 |
|---|---|
| `--check` | 検証のみ。HTML を書かない。pre-commit と CI 向け |
| `<file.json>` | 対象を明示する。省略すると既定の 2 ディレクトリを走査する |

図種はファイル名の末尾で決まる。`<slug>.<kind>.json` の `<kind>` は `architecture` `workflow` `sequence` `dataflow` `lifecycle` のいずれか。

| 図種 | 対象 |
|---|---|
| Architecture | コンポーネント、サービス、ストレージ、境界 |
| Workflow | CI/CD、承認フロー、ツール呼び出し |
| Sequence | API 呼び出し、フォールバック、認証、非同期トレース |
| Data Flow | パイプライン、リネージ、PII の流通 |
| Lifecycle | 状態、リトライ、待機、終端 |

## 内部の挙動

実体は `scripts/build-diagrams.ts`。archify を直接呼ばず、この 1 本が入口を固定している。

1. **起動チェック**: `.claude/skills/archify/bin/archify.mjs` の存在を見る。無ければ複製コマンドを stderr に出して終了コード 1。ここで止まるので、以降の処理は archify がある前提で書かれている
2. **引数の正規化**: `--` で始まらない引数を対象とし、`\` を `/` に置換する。Windows から渡ったパスをそのまま扱えるようにするため
3. **対象の決定**:
   - 明示指定あり → そのファイル。出力先は同じディレクトリ。ただし `templates/archify` 配下だけは `templates/archify/preview` に出す (テンプレート確認用で gitignore 対象)
   - 明示指定なし → `templates/archify` と `knowledge/diagrams` の `*.json` を走査し、kind が既知のものだけ残す
4. **kind の判定**: ベース名を `.` で分割し最後の要素を取る。既知の 5 種でなければ、そのファイルだけ error にして次へ進む (全体は止めない)
5. **実行**: `process.execPath` (今の node) で archify を子プロセス起動する。npx も pnpm exec も挟まない

   ```
   validate <kind> <in>        --quality showcase --json   # --check のとき
   deliver  <kind> <in> <out>  --quality showcase --json   # 通常
   ```

   環境変数に `ARCHIFY_UPDATE_CHECK_DISABLED=1` を足す。第三者コードの外部通信を止めるため
6. **出力先の作成**: deliver のときだけ、出力ディレクトリを再帰的に作る
7. **結果の解釈**: stdout の JSON を読む。`ok` は「終了コード 0 かつ `json.ok !== false`」。成功なら `checks=<件数>`、失敗なら `diagnostics[].message` の 1 行目を並べる。JSON として読めなければ生出力の先頭 300 字を出す
8. **終了**: 1 件でも失敗があれば終了コード 1。ログはすべて stderr

出力例。

```
ok: knowledge/diagrams/foo.architecture.json -> knowledge/diagrams/foo.architecture.html checks=9
diagrams=1 failed=0
```

## 設計判断

**なぜプロジェクトローカルに置くか。** グローバルインストールだと環境ごとにバージョンが割れ、同じ JSON が人によって通ったり落ちたりする。
`.claude/skills/archify` に複製して、リポジトリと一緒にバージョンを固定した。

**なぜ `pnpm diagrams` で包むか。** archify の CLI は kind・品質プロファイル・出力先・`--json` を毎回指定する必要があり、手で打つと揺れる。
包むことで、対象の探索・kind の判定・環境変数・結果の解釈を 1 か所に固定できる。

**なぜ子プロセスを `process.execPath` で起動するか。** `npx` も `pnpm exec` も挟まない。wrapper のプロセス起動が実行時間のほとんどを占めるため (`.claude/rules/scripting.md` の実測表)。

**なぜテンプレートを複製するか。** archify の JSON は座標を含む。白紙から書くとレイアウト検証に落ち続ける。
`templates/archify/` の 7 本は showcase の 9 チェックを error 0 / warning 0 で通してあるので、ラベルの差し替えだけで済む。

## 手順

1. [templates/archify/README.md](../../../templates/archify/README.md) の表から一番近いパターンを選ぶ。7 本とも showcase の 9 チェックを error 0、warning 0 で通している。
2. `knowledge/diagrams/<slug>.<kind>.json` にコピーする。
3. `meta.title`、ノードの `label` / `sublabel` / `tag`、`cards`、`views[].note` を差し替える。ID を変えるなら `from` / `to` / `focus` / `mainPath` も揃える。
4. ノード数を変えない限り座標は触らない。変えたら 1 つずつ検証する。

   ```sh
   pnpm diagrams --check knowledge/diagrams/<slug>.<kind>.json
   ```

5. HTML を生成し、本文から相対パスでリンクする。

   ```sh
   pnpm diagrams knowledge/diagrams/<slug>.<kind>.json
   ```

`pnpm diagrams` を通さず archify を直接叩く場合はこの 4 つ。

```sh
node .claude/skills/archify/bin/archify.mjs doctor
node .claude/skills/archify/bin/archify.mjs guide "Show CI/CD checks, approval, deploy, and rollback"
node .claude/skills/archify/bin/archify.mjs validate architecture foo.architecture.json --json
node .claude/skills/archify/bin/archify.mjs deliver architecture foo.architecture.json foo.html --quality showcase --json
```

## 確認方法

`pnpm diagrams --check` が `ok: ... checks=9` を返す。生成 HTML をブラウザで開き、ラベルの重なりと主経路の見やすさを目で確認する (deliver は決定的検査だけで、見た目の良し悪しは判定しない)。

## つまずきどころ

- **sequence の y 座標** は 160〜677 に収める。viewBox 高さを変えても上限は変わらない
- **lifecycle の待機・終端列** は主経路の `col N+2` の真下に置かれる。`waiting` の col 0 は主経路 col 2 の下。斜めに繋ぐ遷移は endpoint-side-direction で落ちる
- **dataflow の row** は 0〜4。5 以降は座標が NaN になる
- **workflow の交差** は診断の座標だけでは原因が分かりにくい。`meta.quality_profile` を一時的に `standard` にして `--layout-json` を付けるとノード矩形と経路の点列が取れる
- **architecture の境界に沿う経路** (container-border-run) は、境界の外側に 40px 以上離して迂回させる
- **ファイル名の kind を間違えると走査から漏れる。** 引数なしの `pnpm diagrams` では静かに対象外になる
- 直しても改善しないときは、ノードやエッジを減らす方が早い。archify の指針も「主経路 1 本、ノード 12 個まで、細部はカードへ」
