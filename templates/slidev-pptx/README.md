# slidev-pptx

Slidev で作ったスライドを、**編集可能な**ネイティブ PowerPoint に移すためのテンプレート。

figure を画像に焼かない。PowerPoint 側でテキストも図形の色も後から直せる。

## 考え方

PPTX の図形を Vue コンポーネントとして先に用意しておき、スライドはそれを組んで書く。
すると変換は「HTML を解釈する」ではなく「印の付いた要素を引き当てる」になり、対応表の外の形が出てこない。

| 工程 | 担当 | やること |
|---|---|---|
| 1 | Vue コンポーネント | どの PPTX 図形になるかを `data-pptx` で宣言する |
| 2 | Chromium (Playwright) | CSS で組版し、位置・大きさ・色・文字サイズを確定させる |
| 3 | Python (python-pptx) | 確定した値をネイティブ図形として置き直す |

レイアウトを決めるのはブラウザ、意味を決めるのはコンポーネント、組み立てるのは Python。役割が重ならない。

## 使い方

```sh
cd templates/slidev-pptx
pnpm install
pnpm exec playwright install chromium   # 初回だけ (約 110 MB)

pnpm dev                                 # ブラウザで確認しながら slides.md を書く
pnpm deck                                # build + extract。shapes.json ができる

cd ../..
pnpm pptx templates/slidev-pptx/shapes.json -o templates/slidev-pptx/out/deck.pptx
```

`pnpm deck` は `pnpm build` (Slidev のビルド) と `pnpm extract` (Chromium で読み取り) をまとめて実行する。

Chromium を自分で置いている場合は `PPTX_CHROME` に実行ファイルのパスを渡す。

## コンポーネント

| コンポーネント | PPTX での形 | 使うところ |
|---|---|---|
| `<PptxShape preset="...">` | AUTO_SHAPE (プリセット図形) | 箱、丸、矢羽根などの図形 |
| `<PptxText>` | TEXT_BOX | 塗りも枠線も要らない文字 |
| `<PptxLine>` | 直線コネクタ (矢じり付き) | 図形をつなぐ線 |
| `<PptxTable>` | TABLE | 表。中に markdown の表をそのまま書く |
| `<PptxImage>` | PICTURE | 画像。ここだけ編集できない |

`<PptxShape>` の `preset` に使える語。CSS 側の見た目もこの語で切り替わる。

| preset | MSO_SHAPE |
|---|---|
| `rect` | RECTANGLE |
| `roundRect` | ROUNDED_RECTANGLE |
| `ellipse` | OVAL |
| `triangle` | ISOSCELES_TRIANGLE |
| `diamond` | DIAMOND |
| `pentagon` | REGULAR_PENTAGON |
| `hexagon` | HEXAGON |
| `chevron` | CHEVRON |
| `homePlate` | PENTAGON |
| `rightArrow` | RIGHT_ARROW |
| `parallelogram` | PARALLELOGRAM |
| `trapezoid` | TRAPEZOID |

表に無い preset を渡すと矩形になり、`pnpm pptx` が warning を出す。増やすときは
`components/PptxShape.vue` の CSS と `scripts/pptx/shapes_to_pptx.py` の `PRESETS` の両方に足す。

## 印を付けていない markdown

見出し・段落・箇条書き・表・画像は、コンポーネントで囲まなくてもテキストボックスとして拾う。
素の Slidev のデッキがそのまま変換でき、図形にしたいところだけコンポーネントで上書きできる。
印の付いた要素だけにしたいときは `pnpm extract --no-auto`。

## 分かっている制限

- **clip-path で切る形 (triangle 以降) は枠線がブラウザ側で消える。** PPTX では枠線が付く。塗りだけで作ると差が出ない
- **グラデーションと影は落ちる。** 変換するのは単色の塗りと単色の枠線だけ
- `<PptxImage>` は同一オリジンの画像だけ届く。外部 URL の画像は空になる
- スライドの縦横比は Slidev 側の設定に関わらず、`--aspect` (既定 16:9) で決め打つ
- Web フォントを外から取ると、取れなかったときに組版が変わる。`slides.md` の frontmatter で
  `fonts.provider: none` にしてローカルのフォントを指定しておくと環境差が出ない

## ファイル

```
components/          図形の Vue コンポーネント
scripts/
  extract-shapes.ts  dist を Chromium で開き shapes.json を書き出す
slides.md            全コンポーネントを 1 度ずつ使う例
```

PPTX を組み立てるのはリポジトリ側の `scripts/pptx/shapes_to_pptx.py` (`pnpm pptx`)。
`shapes.json` の形が両者の境界なので、Slidev 以外から作った指示書も同じコマンドで PPTX にできる。

要件と仕様は [.claude/docs/00_requirement/slidev-pptx.md](../../.claude/docs/00_requirement/slidev-pptx.md) と
[.claude/docs/10_spec/slidev-pptx.md](../../.claude/docs/10_spec/slidev-pptx.md)。
