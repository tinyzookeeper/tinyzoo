<script setup lang="ts">
// A text of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: the rich
// text in the look's .prose-look, as the looks draw a text's body. One root element.
import type { LayoutText } from '../utils/layout'

defineProps<{ block: LayoutText; index?: number }>()
</script>

<template>
  <CmsContent :doc="block.body" class="kit-lay-item kit-lay-text prose-look" :class="`kit-lay-${block.size}`" />
</template>
