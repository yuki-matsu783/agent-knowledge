<!-- 塗りも枠線も持たないテキストボックス。PPTX では TEXT_BOX になる -->
<script setup lang="ts">
withDefaults(defineProps<{ anchor?: 'top' | 'middle' | 'bottom' }>(), { anchor: 'top' })
</script>

<template>
  <div
    class="pptx-text"
    data-pptx="textbox"
    :data-pptx-anchor="anchor"
    :style="{ justifyContent: anchor === 'top' ? 'flex-start' : anchor === 'bottom' ? 'flex-end' : 'center' }"
  >
    <slot />
  </div>
</template>

<style>
.pptx-text { box-sizing: border-box; display: flex; flex-direction: column; }
</style>
