<script setup lang="ts">
// A heading of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: the
// look's h2 (large) or h3 (medium, small) from its .prose-look. Never an h1. One root element, so
// the editor in the preview can mark it. Empty (only while editing): its name in the admin's language
// ("Nadpis"), quiet, in the look's heading type and size; a quiet bar when the admin gave no name.
import type { LayoutHeading } from '../utils/layout'

defineProps<{ block: LayoutHeading; index?: number }>()
const ghost = useCmsEditingLabel('heading')
</script>

<template>
  <div class="kit-lay-item kit-lay-heading prose-look" :class="[`kit-lay-${block.size}`, `kit-lay-h-${block.level}`, block.empty ? 'kit-lay-ghost' : '']">
    <template v-if="block.empty">
      <component :is="block.level === 'large' ? 'h2' : 'h3'" v-if="ghost" class="kit-lay-h kit-lay-ghost-words" aria-hidden="true">{{ ghost }}</component>
      <span v-else class="kit-lay-ghost-bar kit-lay-ghost-title" aria-hidden="true" />
    </template>
    <component :is="block.level === 'large' ? 'h2' : 'h3'" v-else class="kit-lay-h"><KitMarked :text="block.text" plain /></component>
  </div>
</template>
