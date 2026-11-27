<script setup lang="ts">
// A heading of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: large is
// the heading of the look's own sections (the classes its Text part gives it, `heading` in looks.ts),
// medium the look's h3 from its .prose-look, small a quieter h3. Never an h1. One root element, so the
// editor in the preview can mark it. Empty (only while editing): its name in the admin's language
// ("Nadpis"), quiet, in the look's heading type and size; a quiet bar when the admin gave no name.
// Its text is marked for the editor in the preview (cmsField), so it is typed right in the page.
import type { LayoutHeading } from '../utils/layout'

const props = defineProps<{ block: LayoutHeading; index?: number }>()
const ghost = useCmsEditingLabel('heading')
const look = await useLookHeading()
// A large heading in the look's own section style sits outside .prose-look, as the look's sections' heading does.
const large = computed(() => props.block.level === 'large' && !!look.value)
</script>

<template>
  <div class="kit-lay-item kit-lay-heading" :class="[`kit-lay-${block.size}`, `kit-lay-h-${block.level}`, large ? 'kit-lay-h-look' : 'prose-look', block.empty ? 'kit-lay-ghost' : '']">
    <template v-if="block.empty">
      <component :is="block.level === 'large' ? 'h2' : 'h3'" v-if="ghost" class="kit-lay-h kit-lay-ghost-words" :class="large ? look : ''" aria-hidden="true" v-bind="cmsField('text')">{{ ghost }}</component>
      <span v-else class="kit-lay-ghost-bar kit-lay-ghost-title" aria-hidden="true" />
    </template>
    <component :is="block.level === 'large' ? 'h2' : 'h3'" v-else class="kit-lay-h" :class="large ? look : ''" v-bind="cmsField('text')"><KitMarked :text="block.text" plain /></component>
  </div>
</template>
