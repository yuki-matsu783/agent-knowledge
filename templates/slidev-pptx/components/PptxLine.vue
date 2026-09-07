<!--
  直線・矢印。要素の外接矩形の対角線を線分として書き出す。
  dir が 'right' / 'down' のときは水平・垂直の線分になるよう高さ / 幅を 0 にしている。
-->
<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 矢じりの向き。none なら両端とも付けない */
    arrow?: 'none' | 'end' | 'start' | 'both'
    /** 線の向き。right = 水平、down = 垂直、diag = 要素の対角線 */
    dir?: 'right' | 'down' | 'diag'
  }>(),
  { arrow: 'end', dir: 'right' },
)
</script>

<template>
  <div class="pptx-line" data-pptx="line" :data-pptx-arrow="arrow" :data-pptx-dir="dir" />
</template>

<style>
.pptx-line {
  box-sizing: border-box;
  border-top: 2px solid currentColor;
  align-self: center;
}
.pptx-line[data-pptx-dir='down'] { border-top: none; border-left: 2px solid currentColor; }
</style>
