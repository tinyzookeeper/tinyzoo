<script setup lang="ts">
// A text of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: the rich
// text in the look's .prose-look, as the looks draw a text's body. One root element. Empty (only
// while editing): three quiet lines.
import type { LayoutText } from '../utils/layout'

defineProps<{ block: LayoutText; index?: number }>()
</script>

<template>
  <div v-if="block.empty" class="kit-lay-item kit-lay-text kit-lay-ghost prose-look" :class="`kit-lay-${block.size}`" aria-hidden="true">
    <span class="kit-lay-ghost-bar" /><span class="kit-lay-ghost-bar" /><span class="kit-lay-ghost-bar kit-lay-ghost-short" />
  </div>
  <CmsContent v-else :doc="block.body" class="kit-lay-item kit-lay-text prose-look" :class="`kit-lay-${block.size}`" />
</template>
