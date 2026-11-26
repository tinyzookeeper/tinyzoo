<script setup lang="ts">
// A button of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: the
// look's main button (KitSectionButton). One root element. Without its text or its link (only while
// editing): a dashed outline of a button, with the text when it has one.
import type { LayoutButton } from '../utils/layout'

defineProps<{ block: LayoutButton; index?: number }>()
</script>

<template>
  <div class="kit-lay-item kit-lay-button" :class="[`kit-lay-${block.size}`, block.empty ? 'kit-lay-ghost' : '']">
    <span v-if="block.empty" class="kit-lay-ghost-btn"><span v-if="block.label">{{ block.label }}</span><span v-else class="kit-lay-ghost-bar" aria-hidden="true" /></span>
    <KitSectionButton v-else :to="siteHref(block.href)" :label="block.label" />
  </div>
</template>
