<script setup lang="ts">
// A heading of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: the
// look's h2 (large) or h3 (medium, small) from its .prose-look. Never an h1. One root element, so
// the editor in the preview can mark it.
import type { LayoutHeading } from '../utils/layout'

defineProps<{ block: LayoutHeading; index?: number }>()
</script>

<template>
  <div class="kit-lay-item kit-lay-heading prose-look" :class="[`kit-lay-${block.size}`, `kit-lay-h-${block.level}`]">
    <component :is="block.level === 'large' ? 'h2' : 'h3'" class="kit-lay-h"><KitMarked :text="block.text" plain /></component>
  </div>
</template>
