<!--
  PowerPoint の図形 1 つ。ブラウザでは CSS で、PPTX では python-pptx のプリセット図形で描く。
  preset の語彙は README の対応表が正。ここに無い形は使わない (変換側が rect に落とす)。
-->
<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 図形の種類。README の対応表にある語だけを使う */
    preset?: string
    /** 縦位置。PPTX の text frame の vertical anchor に対応する */
    anchor?: 'top' | 'middle' | 'bottom'
  }>(),
  { preset: 'rect', anchor: 'middle' },
)
</script>

<template>
  <div
    class="pptx-shape"
    :data-pptx="preset"
    :data-pptx-anchor="anchor"
    :style="{ justifyContent: anchor === 'top' ? 'flex-start' : anchor === 'bottom' ? 'flex-end' : 'center' }"
  >
    <slot />
  </div>
</template>

<style>
/* scoped にしない。slides.md 側から class で色や大きさを足せるようにするため */
.pptx-shape {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pptx-shape[data-pptx='ellipse'] { border-radius: 50%; }
.pptx-shape[data-pptx='triangle'] { clip-path: polygon(50% 0%, 100% 100%, 0% 100%); }
.pptx-shape[data-pptx='diamond'] { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
.pptx-shape[data-pptx='pentagon'] { clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%); }
.pptx-shape[data-pptx='hexagon'] { clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); }
.pptx-shape[data-pptx='chevron'] { clip-path: polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%, 15% 50%); }
.pptx-shape[data-pptx='homePlate'] { clip-path: polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%); }
.pptx-shape[data-pptx='rightArrow'] { clip-path: polygon(0% 30%, 70% 30%, 70% 0%, 100% 50%, 70% 100%, 70% 70%, 0% 70%); }
.pptx-shape[data-pptx='parallelogram'] { clip-path: polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%); }
.pptx-shape[data-pptx='trapezoid'] { clip-path: polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%); }
</style>
