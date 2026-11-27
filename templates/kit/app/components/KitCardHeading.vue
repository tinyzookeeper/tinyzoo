<script setup lang="ts">
// A heading of a card (BlockSectionList), drawn by <CmsBlocks prefix="KitCard">: an h3 (never an h1) in
// the look's .prose-look, so it takes the look's heading type; its size is one of three steps. One
// root element. A heading that shows nothing (only while editing) is a placeholder with its words.
// A heading with its own text is marked for the editor in the preview (cmsField), so it is typed in the page.
import type { CardHeading } from '../utils/card'

defineProps<{ block: CardHeading; index?: number }>()
</script>

<template>
  <div class="kit-card-item kit-card-heading prose-look" :class="[`kit-card-${block.size}`, `kit-card-h-${block.level}`, block.state ? 'kit-card-ghost' : '', block.sample ? 'kit-card-sample' : '']" :data-kit-card-state="block.state">
    <KitCardChip v-if="block.state" :state="block.state" :name="block.name" type="heading" />
    <h3 v-else class="kit-card-h" v-bind="block.text !== undefined ? cmsField('text') : {}">{{ block.shown }}</h3>
  </div>
</template>
