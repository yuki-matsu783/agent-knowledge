/**
 * Slidev のビルド成果物 (dist) をヘッドレス Chromium で開き、data-pptx を持つ要素を
 * 「PPTX の図形の指示書」(shapes.json) として書き出す。
 *
 * 使い方:
 *   pnpm extract [--dist dist] [--out shapes.json] [--width 1600] [--no-auto]
 *
 * 設計上の注意:
 * - 位置と大きさはスライド枠に対する比 (0..1) で出す。Slidev はスライドを CSS transform で
 *   拡大縮小するので、絶対 px を出すと表示倍率に依存してしまう。
 * - getComputedStyle が返す長さ (font-size, border-width) は transform 前の値、
 *   getBoundingClientRect は transform 後の値。混ぜると倍率のぶんだけずれるので、
 *   scale = rect.width / offsetWidth を掛けて後者の座標系に揃える。
 * - 既定では data-pptx が付いていない markdown のブロックもテキストボックスとして拾う。
 *   素の Slidev のデッキがそのまま変換でき、図形にしたいところだけコンポーネントで上書きできる。
 *   --no-auto で印の付いた要素だけにする。
 * - スライドの切り替えは history の path (/1, /2, ...)。ハッシュ (#/2) では切り替わらない。
 * - 総枚数は数えられない (前後 1 枚しか DOM に無い)。1 枚ずつ進んで無くなったら終わる。
 */
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { chromium } from 'playwright'

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const distDir = resolve(arg('dist', 'dist'))
const outPath = resolve(arg('out', 'shapes.json'))
const viewportWidth = Number(arg('width', '1600'))
/** 印の無い markdown ブロック (見出し・段落・箇条書き・表・画像) もテキストボックスとして拾う */
const auto = !process.argv.includes('--no-auto')

/** dist を配るだけの静的サーバー。file:// では history routing が効かないので必要 */
async function serve(root: string) {
  const server = createServer(async (req, res) => {
    const url = (req.url ?? '/').split('?')[0]
    const file = join(root, normalize(url === '/' ? '/index.html' : url))
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(await readFile(join(root, 'index.html')))
    }
  })
  await new Promise<void>((r) => server.listen(0, r))
  const { port } = server.address() as { port: number }
  return { port, close: () => server.close() }
}

/** ブラウザ側で走る。外側のスコープを参照しないこと (関数ごと直列化されるため) */
function collect({ slideNo, auto }: { slideNo: number; auto: boolean }) {
  const root = document.querySelector(`.slidev-page-${slideNo}`) as HTMLElement | null
  if (!root) return { index: slideNo, aspect: 16 / 9, shapes: [] as unknown[] }
  const box = root.getBoundingClientRect()
  // getComputedStyle の長さは transform 前。rect の座標系に揃える倍率
  const scale = box.width / root.offsetWidth

  const rgb = (v: string): [number, number, number] | null => {
    const m = (v || '').match(/[\d.]+/g)
    if (!m || m.length < 3) return null
    if (m.length > 3 && Number(m[3]) === 0) return null // 完全に透明
    return [Math.round(+m[0]), Math.round(+m[1]), Math.round(+m[2])]
  }
  const frame = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { x: (r.x - box.x) / box.width, y: (r.y - box.y) / box.height, w: r.width / box.width, h: r.height / box.height }
  }
  const runOf = (el: Element, text: string) => {
    const cs = getComputedStyle(el)
    return {
      t: text,
      size: (parseFloat(cs.fontSize) * scale) / box.height,
      bold: Number(cs.fontWeight) >= 600,
      italic: cs.fontStyle === 'italic',
      color: rgb(cs.color) ?? [0, 0, 0],
      font: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    }
  }
  /** 要素の中身を段落 + run に分ける。中に別の data-pptx があればそこで打ち切る */
  const textOf = (el: Element) => {
    const paragraphs: { align: string; level: number; bullet: boolean; runs: ReturnType<typeof runOf>[] }[] = []
    let cur: (typeof paragraphs)[number] | null = null
    const open = (src: Element, level: number, bullet: boolean) => {
      cur = { align: getComputedStyle(src).textAlign || 'left', level, bullet, runs: [] }
    }
    const flush = () => {
      if (cur && cur.runs.length) paragraphs.push(cur)
      cur = null
    }
    const walk = (node: Element, level: number) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const t = (child.textContent ?? '').replace(/\s+/g, ' ')
          if (!t.trim()) continue
          if (!cur) open(node, level, false)
          cur!.runs.push(runOf(child.parentElement ?? node, t))
          continue
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue
        const e = child as HTMLElement
        if (e.tagName === 'BR') { flush(); continue }
        if (e.hasAttribute('data-pptx')) continue // 入れ子の図形は別の shape として拾う
        const display = getComputedStyle(e).display
        if (e.tagName === 'LI') { flush(); open(e, Math.max(level - 1, 0), true); walk(e, level); flush(); continue }
        if (e.tagName === 'UL' || e.tagName === 'OL') { flush(); walk(e, level + 1); continue }
        if (display === 'block' || display === 'flex' || display === 'grid' || display === 'table') {
          flush(); walk(e, level); flush(); continue
        }
        walk(e, level)
      }
    }
    walk(el, 0)
    flush()
    return paragraphs
  }

  const cellOf = (td: Element) => {
    const cs = getComputedStyle(td)
    return { text: (td as HTMLElement).innerText.trim(), align: cs.textAlign || 'left', bold: Number(cs.fontWeight) >= 600 }
  }

  const shapes: Record<string, unknown>[] = []
  // 印を付けた要素と、印の外に残った素の markdown ブロックを、DOM の順 (= 重なり順) で拾う
  const AUTO = 'h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote,pre,table,img'
  const selector = auto ? `[data-pptx],${AUTO}` : '[data-pptx]'
  for (const el of Array.from(root.querySelectorAll(selector))) {
    const marked = (el as HTMLElement).dataset.pptx
    if (!marked) {
      // 印の中にあるもの、別の自動対象の中にあるもの、空のものは飛ばす
      if (el.closest('[data-pptx]')) continue
      if (el.parentElement?.closest(AUTO)) continue
      if (el.tagName !== 'IMG' && !(el as HTMLElement).innerText.trim()) continue
    }
    const kind = marked ?? (el.tagName === 'TABLE' ? 'table' : el.tagName === 'IMG' ? 'image' : 'textbox')
    const cs = getComputedStyle(el)
    const common = { frame: frame(el), anchor: (el as HTMLElement).dataset.pptxAnchor ?? 'top' }
    if (kind === 'line') {
      shapes.push({
        kind: 'line',
        ...common,
        dir: (el as HTMLElement).dataset.pptxDir ?? 'right',
        arrow: (el as HTMLElement).dataset.pptxArrow ?? 'end',
        color: rgb(cs.borderTopColor) ?? rgb(cs.borderLeftColor) ?? rgb(cs.color) ?? [0, 0, 0],
        width: (Math.max(parseFloat(cs.borderTopWidth) || 0, parseFloat(cs.borderLeftWidth) || 0) * scale) / box.width,
      })
      continue
    }
    if (kind === 'table') {
      const table = el.tagName === 'TABLE' ? (el as HTMLTableElement) : el.querySelector('table')
      if (!table) continue
      shapes.push({
        kind: 'table',
        ...common,
        header: (el as HTMLElement).dataset.pptxHeader !== 'false' && !!table.querySelector('th'),
        rows: Array.from(table.querySelectorAll('tr')).map((tr) => Array.from(tr.querySelectorAll('th,td')).map(cellOf)),
        size: (parseFloat(getComputedStyle(table).fontSize) * scale) / box.height,
      })
      continue
    }
    if (kind === 'image') {
      const img = el.tagName === 'IMG' ? (el as HTMLImageElement) : el.querySelector('img')
      if (!img) continue
      shapes.push({ kind: 'image', ...common, src: img.currentSrc || img.src })
      continue
    }
    const borderWidth = (parseFloat(cs.borderTopWidth) || 0) * scale
    const isText = kind === 'textbox'
    shapes.push({
      kind: isText ? 'text' : 'auto',
      preset: isText ? undefined : kind,
      ...common,
      fill: isText ? null : rgb(cs.backgroundColor),
      line: isText || borderWidth === 0 ? null : { color: rgb(cs.borderTopColor) ?? [0, 0, 0], width: borderWidth / box.width },
      radius: ((parseFloat(cs.borderTopLeftRadius) || 0) * scale) / box.width,
      paragraphs: textOf(el),
    })
  }
  return { index: slideNo, aspect: box.width / box.height, shapes }
}

const site = await serve(distDir)
const browser = await chromium.launch(
  process.env.PPTX_CHROME ? { executablePath: process.env.PPTX_CHROME } : {},
)
try {
  const page = await browser.newPage({ viewport: { width: viewportWidth, height: Math.round(viewportWidth * 0.7) } })
  const base = `http://127.0.0.1:${site.port}`
  // 枚数は数えず、1 枚ずつ進んで「その番号のスライドが DOM に無い」ところで止める。
  // /print は 1 枚ずつ後から生えてくるので固定待ちだと数え落とす。範囲外の番号 (/9999) は
  // 1 枚目に落ちるので、.slidev-page-N の有無がそのまま N 枚目の存在になる。
  const slides = []
  for (let n = 1; n <= 500; n++) {
    await page.goto(`${base}/${n}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    const exists = await page.evaluate((i) => !!document.querySelector(`.slidev-page-${i}`), n)
    if (!exists) break
    const slide = await page.evaluate(collect, { slideNo: n, auto })
    // 画像は同一オリジンなので Node 側で取り直して base64 に入れ替える
    for (const shape of slide.shapes as { kind: string; src?: string; data?: string }[]) {
      if (shape.kind !== 'image' || !shape.src) continue
      const res = await page.request.get(shape.src)
      shape.data = Buffer.from(await res.body()).toString('base64')
      delete shape.src
    }
    slides.push(slide)
    process.stderr.write(`slide ${n}: ${slide.shapes.length} shapes\n`)
  }
  if (slides.length === 0) throw new Error(`スライドが見つからない: ${distDir} は slidev build の出力か確認する`)

  const doc = { meta: { generator: 'extract-shapes', aspect: slides[0]?.aspect ?? 16 / 9, slides: slides.length }, slides }
  await writeFile(outPath, JSON.stringify(doc, null, 2), 'utf8')
  process.stderr.write(`wrote ${outPath}\n`)
} finally {
  await browser.close()
  site.close()
}
