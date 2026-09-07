<!-- 画像。PPTX では PICTURE になる (編集はできない)。src は同一オリジンのものだけ届く -->
<script setup lang="ts">
defineProps<{ src: string; alt?: string }>()
</script>

<template>
  <img class="pptx-image" data-pptx="image" :src="src" :alt="alt ?? ''" />
</template>

<style>
.pptx-image { display: block; max-width: 100%; }
</style>
