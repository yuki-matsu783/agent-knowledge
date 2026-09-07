---
theme: default
title: Slidev から編集可能な PPTX へ
# フォントを取りに行かせない。外部通信できない環境でも同じ組版になる
fonts:
  provider: none
  sans: Noto Sans JP, Yu Gothic UI, sans-serif
  mono: Consolas, monospace
---

<PptxText anchor="middle" class="h-full">

# Slidev から編集可能な PPTX へ

図形を Vue コンポーネントで書き、ブラウザに並べさせ、Python が PPTX に置き直す

</PptxText>

---

# 3 つの工程

<div class="flex items-center gap-3 mt-10">
  <PptxShape preset="roundRect" class="flex-1 h-24 bg-sky-100 border-2 border-sky-600 rounded-xl text-center px-3">

**Vue** で図形を書く

  </PptxShape>
  <PptxLine class="w-12 text-sky-700" />
  <PptxShape preset="roundRect" class="flex-1 h-24 bg-sky-100 border-2 border-sky-600 rounded-xl text-center px-3">

**Chromium** が並べる

  </PptxShape>
  <PptxLine class="w-12 text-sky-700" />
  <PptxShape preset="roundRect" class="flex-1 h-24 bg-emerald-100 border-2 border-emerald-600 rounded-xl text-center px-3">

**Python** が置き直す

  </PptxShape>
</div>

---

# 使える図形

<div class="grid grid-cols-5 gap-3 mt-8 text-sm text-center">
  <PptxShape preset="rect" class="h-20 bg-slate-200">rect</PptxShape>
  <PptxShape preset="roundRect" class="h-20 bg-slate-200 rounded-2xl">roundRect</PptxShape>
  <PptxShape preset="ellipse" class="h-20 bg-slate-200">ellipse</PptxShape>
  <PptxShape preset="triangle" class="h-20 bg-slate-200">triangle</PptxShape>
  <PptxShape preset="diamond" class="h-20 bg-slate-200">diamond</PptxShape>
  <PptxShape preset="pentagon" class="h-20 bg-amber-200">pentagon</PptxShape>
  <PptxShape preset="hexagon" class="h-20 bg-amber-200">hexagon</PptxShape>
  <PptxShape preset="chevron" class="h-20 bg-amber-200">chevron</PptxShape>
  <PptxShape preset="homePlate" class="h-20 bg-amber-200">homePlate</PptxShape>
  <PptxShape preset="rightArrow" class="h-20 bg-amber-200">rightArrow</PptxShape>
  <PptxShape preset="parallelogram" class="h-20 bg-rose-200">parallelogram</PptxShape>
  <PptxShape preset="trapezoid" class="h-20 bg-rose-200">trapezoid</PptxShape>
</div>

---

# 文字と表

<div class="grid grid-cols-2 gap-8 mt-6">

<PptxText anchor="top">

- **太字**と*斜体*が run に分かれる
- 箇条書きは段落の level になる
  - 入れ子も 1 段だけ試した
- <span class="text-red-600">色は computed style から取る</span>

</PptxText>

<PptxTable>

| 要素 | PPTX での形 |
|---|---|
| PptxShape | AUTO_SHAPE |
| PptxText | TEXT_BOX |
| PptxLine | 直線コネクタ |
| PptxTable | ネイティブ TABLE |

</PptxTable>

</div>
