<script setup lang="ts">
// A button of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: the
// look's main button (KitSectionButton). One root element.
import type { LayoutButton } from '../utils/layout'

defineProps<{ block: LayoutButton; index?: number }>()
</script>

<template>
  <div class="kit-lay-item kit-lay-button" :class="`kit-lay-${block.size}`">
    <KitSectionButton :to="siteHref(block.href)" :label="block.label" />
  </div>
</template>
