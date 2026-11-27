<script setup lang="ts">
// A button of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: the
// look's main button (KitSectionButton). One root element. Without its text or its link (only while
// editing): a dashed outline of a button with its text, or with its name in the admin's language
// ("Tlačítko"), quiet. Its text is marked for the editor in the preview (cmsField), so it is typed in the page.
import type { LayoutButton } from '../utils/layout'

defineProps<{ block: LayoutButton; index?: number }>()
const ghost = useCmsEditingLabel('button')
</script>

<template>
  <div class="kit-lay-item kit-lay-button" :class="[`kit-lay-${block.size}`, block.empty ? 'kit-lay-ghost' : '']">
    <span v-if="block.empty" class="kit-lay-ghost-btn">
      <span v-if="block.label" v-bind="cmsField('label')">{{ block.label }}</span>
      <span v-else-if="ghost" class="kit-lay-ghost-words" aria-hidden="true" v-bind="cmsField('label')">{{ ghost }}</span>
      <span v-else class="kit-lay-ghost-bar" aria-hidden="true" />
    </span>
    <KitSectionButton v-else :to="siteHref(block.href)" :label="block.label" field="label" />
  </div>
</template>
