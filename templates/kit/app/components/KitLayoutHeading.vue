<script setup lang="ts">
// A heading of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: the
// look's h2 (large) or h3 (medium, small) from its .prose-look. Never an h1. One root element, so
// the editor in the preview can mark it. Empty (only while editing): a quiet bar of its size.
import type { LayoutHeading } from '../utils/layout'

defineProps<{ block: LayoutHeading; index?: number }>()
</script>

<template>
  <div class="kit-lay-item kit-lay-heading prose-look" :class="[`kit-lay-${block.size}`, `kit-lay-h-${block.level}`, block.empty ? 'kit-lay-ghost' : '']">
    <span v-if="block.empty" class="kit-lay-ghost-bar kit-lay-ghost-title" aria-hidden="true" />
    <component :is="block.level === 'large' ? 'h2' : 'h3'" v-else class="kit-lay-h"><KitMarked :text="block.text" plain /></component>
  </div>
</template>
