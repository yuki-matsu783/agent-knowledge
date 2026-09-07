---
type: spec
title: Slidev から編集可能な PPTX への変換の仕様
description: >-
  Full specification of the Slidev to editable PowerPoint pipeline in this repository: the
  data-pptx contract the Vue components emit, how the Playwright extractor walks slides and
  normalises geometry, the exact shape of shapes.json, and how the Python builder maps it onto
  python-pptx shapes, tables, connectors and bullets. Covers the measured pitfalls: tsx keepNames
  breaking page.evaluate, Slidev routing by path rather than hash, only neighbouring slides being
  in the DOM, and computed styles being pre-transform while bounding boxes are post-transform.
  Use when changing, extending, or debugging the pipeline. Not for deciding whether pptx is the
  right deliverable (see the requirement).
status: stable
verified_at: 2026-09-07
applies_to: [slidev@52.19, playwright@1.63, python-pptx@1.0, node@22, python@3.12, pnpm@10.33]
sources:
  - https://sli.dev/
  - https://python-pptx.readthedocs.io/
  - https://playwright.dev/
  - ../../../templates/slidev-pptx/scripts/extract-shapes.ts
  - ../../../scripts/pptx/shapes_to_pptx.py
  - ../../../templates/slidev-pptx/components/PptxShape.vue
---

# Slidev から編集可能な PPTX への変換の仕様

要件と適用範囲は [00_requirement/slidev-pptx.md](../00_requirement/slidev-pptx.md) にある。

## 前提

- デッキ側の道具は `templates/slidev-pptx/` に閉じている。`pnpm install` はそのディレクトリで行う。
  Slidev と Playwright で 650 パッケージ入るので、リポジトリ本体の依存には混ぜていない
- Chromium は `pnpm exec playwright install chromium` で 1 度だけ取る (約 110 MB)。
  すでに手元にあるなら環境変数 `PPTX_CHROME` に実行ファイルのパスを渡す
- PPTX を組み立てる側はリポジトリ本体の Python 環境 (`uv sync`)。依存は python-pptx

## 外部インタフェース

```sh
# templates/slidev-pptx/ で
pnpm dev                  # 確認用のサーバー
pnpm build                # Slidev を dist/ にビルドする
pnpm extract [オプション]   # dist/ を読んで shapes.json を書く
pnpm deck                 # build + extract

# リポジトリルートで
pnpm pptx <shapes.json> -o <out.pptx> [--aspect 16:9|4:3|16:10]
```

`pnpm extract` のオプション。

| オプション | 既定 | 内容 |
|---|---|---|
| `--dist <dir>` | `dist` | 読み取る Slidev のビルド出力 |
| `--out <file>` | `shapes.json` | 書き出す指示書 |
| `--width <px>` | `1600` | ブラウザの横幅。座標は比で出すので結果には影響しない |
| `--no-auto` | (自動拾いは有効) | `data-pptx` の付いた要素だけを拾う |

## data-pptx の約束

Vue コンポーネントが DOM に置く属性が、変換側との唯一の契約。

| 属性 | 値 | 意味 |
|---|---|---|
| `data-pptx` | `rect` `roundRect` `ellipse` `triangle` `diamond` `pentagon` `hexagon` `chevron` `homePlate` `rightArrow` `parallelogram` `trapezoid` | プリセット図形 |
| `data-pptx` | `textbox` | テキストボックス |
| `data-pptx` | `line` | 直線コネクタ |
| `data-pptx` | `table` | 表。中の最初の `<table>` を読む |
| `data-pptx` | `image` | 画像 |
| `data-pptx-anchor` | `top` `middle` `bottom` | 文字の縦位置 |
| `data-pptx-dir` | `right` `down` `diag` | 線の向き |
| `data-pptx-arrow` | `none` `start` `end` `both` | 矢じり |
| `data-pptx-header` | `true` `false` | 表の 1 行目を見出しにするか |

色・線幅・角丸・文字サイズ・太字・斜体・行揃えは属性で渡さない。すべて computed style から読む。
**見た目の正は CSS 側にある。**属性が持つのは「PPTX のどの図形になるか」だけ。

## shapes.json の形

```jsonc
{
  "meta": { "generator": "extract-shapes", "aspect": 1.7754, "slides": 4 },
  "slides": [
    {
      "index": 1,
      "aspect": 1.7754,
      "shapes": [
        {
          "kind": "auto",              // auto | text | line | table | image
          "preset": "roundRect",
          "frame": { "x": 0.057, "y": 0.29, "w": 0.246, "h": 0.174 },
          "anchor": "middle",
          "fill": [224, 242, 254],
          "line": { "color": [2, 132, 199], "width": 0.002 },
          "radius": 0.011,
          "paragraphs": [
            { "align": "center", "level": 0, "bullet": false,
              "runs": [{ "t": "Vue で図形を書く", "size": 0.0319, "bold": true, "italic": false,
                         "color": [0, 0, 0], "font": "Noto Sans JP" }] }
          ]
        }
      ]
    }
  ]
}
```

**長さはすべてスライド枠に対する比 (0..1)。** `x` `w` `radius` `line.width` は幅に対する比、
`y` `h` `size` は高さに対する比。実寸 (EMU とポイント) に直すのは組み立て側だけ。

## 内部の挙動 (読み取り側)

実体は `templates/slidev-pptx/scripts/extract-shapes.ts`。

1. `dist/` を配るだけの静的サーバーを立てる (ポートは OS 任せ)。`file://` では Slidev の history routing が効かない
2. Chromium を起動し、`/1` `/2` … と**パス**で 1 枚ずつ開く
3. 各スライドで `.slidev-page-N` が DOM に無ければそこで終わり。これが枚数の判定
4. スライド枠の矩形を基準に、`[data-pptx]` と自動拾いの対象を **DOM の順**で走査する。この順がそのまま重なり順になる
5. 文字は要素の子を歩いて段落と run に割る。`<br>` とブロック要素で段落を切り、`<li>` は箇条書きの段落にする。
   入れ子の `<ul>` `<ol>` で level を 1 つ深くする。内側に別の `data-pptx` があればそこで打ち切る
6. 画像は Node 側で取り直して base64 で JSON に埋める

**自動拾い**の対象は `h1`〜`h6` `p` `ul` `ol` `blockquote` `pre` `table` `img`。
`data-pptx` の中にあるもの、他の対象の中にあるもの、中身が空のものは飛ばす。

### 座標をどう揃えているか

Slidev はスライドを CSS transform で拡大縮小する。ここに落とし穴が 2 つある。

- `getBoundingClientRect()` は transform **後**の値を返す
- `getComputedStyle()` の長さ (`font-size`、`border-width`) は transform **前**の値を返す

そのまま混ぜると倍率のぶんだけ文字と線が細くなる。`scale = rect.width / offsetWidth` を computed style 側に掛けて、
rect の座標系に揃えてから比にしている。`offsetWidth` は transform 前のレイアウト幅なので、Slidev の内部を知らずに倍率が出る。

## 内部の挙動 (組み立て側)

実体は `scripts/pptx/shapes_to_pptx.py`。

1. `--aspect` からスライドの実寸を決める (16:9 = 13.333 x 7.5 インチ)。比に実寸を掛けて EMU にする
2. レイアウトは常に空白 (`slide_layouts[6]`)。プレースホルダを継がせない
3. `kind` で組み立て方を選ぶ。`PRESETS` に無い `preset` は矩形にして warning を出す (同じ警告は 1 度だけ)
4. 文字サイズは高さに対する比 × スライド高 (インチ) × 72 でポイントにする
5. `roundRect` の丸みは `radius × スライド幅 ÷ 短辺` を調整値に入れる (上限 0.5)
6. 図形の影は `shadow.inherit = False` で切る。既定のテーマの影が付くのを防ぐ

python-pptx に API が無くて XML を直接触っているのは 2 か所。

- **箇条書き**: 段落の `pPr` に `<a:buChar char="•"/>` を足す。既にある `buNone` / `buAutoNum` は消す
- **矢じり**: 線の `ln` に `<a:tailEnd type="triangle"/>` (と `headEnd`) を足す

## 設計判断

- **なぜ「HTML を解釈する」ではなく「印を引き当てる」のか。** 後から解釈する作りは、
  書ける HTML が無限にあるので必ず取りこぼす。先に PPTX の図形の語彙を決めて、その語彙でしかスライドを書けなくすると、
  変換は対応表の引き当てになり、取りこぼしが「一覧に無い preset」という 1 つの警告に集約される
- **なぜ座標をブラウザに出させるのか。** 位置をコンポーネントの属性で持たせると、
  Slidev のレイアウトと Flexbox を捨てることになり、書くのが手作業になる。組版はブラウザに任せ、
  結果の座標だけ受け取れば、書き味は Slidev のまま PPTX の座標が手に入る
- **なぜ間に JSON を挟むのか。** 読み取り (Node) と組み立て (Python) を別プロセスにできる。
  `shapes.json` が境界なので、Slidev 以外から作った指示書も同じ `pnpm pptx` で PPTX にできる。
  言語の選択は [scripting.md](../../rules/scripting.md) のとおり (Node 製ツールを呼ぶ側は TypeScript、pptx 生成は Python)
- **なぜ読み取り側を `tsx` ではなく `node` で走らせるのか。** つまずきどころに書いたとおり `tsx` では動かない
- **なぜテンプレートを本体の依存に混ぜないのか。** Slidev と Playwright で 650 パッケージ増える。
  スライドを PPTX で出す用事は毎回ではないので、`templates/slidev-pptx/` に閉じて必要なときだけ入れる

## 手順

```sh
cd templates/slidev-pptx
pnpm install
pnpm exec playwright install chromium

# slides.md を書く。図形にしたいところを components/ のコンポーネントで囲む
pnpm dev

pnpm deck
cd ../..
pnpm pptx templates/slidev-pptx/shapes.json -o templates/slidev-pptx/out/deck.pptx
```

## 確認方法

python-pptx で図形の木を読む (PowerPoint は無くてよい)。

```sh
uv run python -c "
from pptx import Presentation
p = Presentation('templates/slidev-pptx/out/deck.pptx')
for i, s in enumerate(p.slides, 1):
    for sh in s.shapes:
        print(i, sh.shape_type, sh.name, repr(sh.has_text_frame and sh.text_frame.text[:30]))
"
```

同梱の `slides.md` (4 枚) で出た結果 (2026-09-07、Linux、Node 22.22 / Python 3.12.3)。

| 元の書き方 | PPTX での形 |
|---|---|
| `<PptxShape preset="roundRect">` | AUTO_SHAPE `Rounded Rectangle`。塗り・枠線・丸み付き |
| `<PptxShape>` の 12 の preset | すべて対応する AUTO_SHAPE (Oval、Isosceles Triangle、Chevron、Right Arrow など) |
| `<PptxText>` | TEXT_BOX |
| `<PptxLine>` | LINE (直線コネクタ)。`tailEnd type="triangle"` 付き |
| `<PptxTable>` に markdown の表 | ネイティブの TABLE (5x2)、1 行目が見出し |
| `**太字**` と `*斜体*` | 同じ段落の中で別々の run。太字・斜体・色が個別に付く |
| 入れ子の箇条書き | `level` 0 と 1 の段落 + `buChar` |
| 印を付けていない `#` 見出し | TEXT_BOX (自動拾い) |

4 枚で図形 23 個、読み取り約 12 秒。ラスタ化は 0 件。

## つまずきどころ

- **`tsx` で走らせると `page.evaluate` が `ReferenceError: __name is not defined` で落ちる。**
  tsx (esbuild) の `keepNames` が関数の中に `__name(...)` を差し込むが、`page.evaluate` は関数を文字列にして
  ブラウザに送るので、ヘルパーが向こうに無い。Node 22.18 以降の型剥がし (`node scripts/extract-shapes.ts`) なら差し込まれない。
  この 1 本だけ `tsx` を使わないのはこれが理由
- **スライドの切り替えはハッシュではなくパス。** `#/2` に変えても表示は 1 枚目のまま。`/2` を開く。
  ハッシュだけの変更では document のロードも起きないので、待っても切り替わらない
- **範囲外の番号は 1 枚目に落ちる。** `/9999` を開くと 1 枚目が出る。`.slidev-page-9999` は DOM に無いので、
  「その番号の要素があるか」で枚数を判定できる
- **DOM に載っているのは前後 1 枚だけ。** `document.querySelectorAll('.slidev-page').length` は 2 を返す。
  `/print` を開くと全部載るが、1 枚ずつ後から生えてくるので固定の待ち時間だと数え落とす (4 枚のデッキで 1.5 秒では 2 枚、3 秒で 4 枚)。
  枚数を数えるのはやめて 1 枚ずつ進める形にした
- **computed style と rect で座標系が違う。**「座標をどう揃えているか」のとおり。
  気づかないと文字と線だけが表示倍率のぶん細くなり、位置は合っているので原因が分かりにくい
- **CSS の `text-align` は `start` を返すことがある。** `left` と決め打つと右寄せの言語で崩れる。組み立て側で `start` / `end` も見る
- **clip-path で切った図形はブラウザ側で枠線が消える。** PPTX では枠線が付くので、ブラウザで見た絵と差が出る。塗りだけで作る
- **Web フォントを外から取る構成だと、取れなかったときに組版ごと変わる。** 位置も文字サイズもブラウザが決めるので、
  フォントが変わると PPTX の座標まで変わる。`slides.md` の frontmatter で `fonts.provider: none` にしてローカルのフォントを指定する
- **実行環境の記録**: Node 22.22、pnpm 10.33、Python 3.12.3、Slidev 52.19.1、Playwright 1.63、
  python-pptx 1.0.2、Chromium 1194、Claude Code on the web (Linux)。
  Windows (Git Bash) と WSL では未確認。**PowerPoint で開いた目視確認もしていない** (この環境に LibreOffice Impress が無く、
  図形の木と XML を読んで確かめたところまで)
