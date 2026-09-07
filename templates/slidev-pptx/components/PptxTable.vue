<!--
  ネイティブの PPTX テーブル。slot に素の <table> を書くか、rows を渡す。
  markdown の表をそのまま囲うのが楽 (Slidev は markdown の表を <table> にする)。
-->
<script setup lang="ts">
withDefaults(defineProps<{ header?: boolean }>(), { header: true })
</script>

<template>
  <div class="pptx-table" data-pptx="table" :data-pptx-header="String(header)">
    <slot />
  </div>
</template>

<style>
.pptx-table { box-sizing: border-box; }
.pptx-table table { width: 100%; border-collapse: collapse; }
</style>
