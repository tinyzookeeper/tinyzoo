<script setup lang="ts">
// A picture of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: cut to
// its shape (its own when original), with the look's corners. One root element.
import type { LayoutPicture } from '../utils/layout'

defineProps<{ block: LayoutPicture; index?: number }>()
</script>

<template>
  <div class="kit-lay-item kit-lay-picture" :class="`kit-lay-${block.size}`">
    <CmsImage :media="block.image" class="kit-lay-img" sizes="(min-width: 64rem) 50vw, 100vw" :style="block.ratio ? { aspectRatio: block.ratio } : undefined" />
  </div>
</template>
