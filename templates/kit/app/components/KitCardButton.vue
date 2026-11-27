<script setup lang="ts">
// A button of a card (BlockSectionList), drawn by <CmsBlocks prefix="KitCard">: the look's main button
// (KitSectionButton), a link to where the entry's field leads. One root element. A button that shows
// nothing (only while editing) is a dashed outline of a button with its text or the words; in the sample
// card, or with no link, the look's button drawn as a non-link. Its text is marked for the editor in
// the preview (cmsField), so it is typed in the page.
import type { CardButton } from '../utils/card'

defineProps<{ block: CardButton; index?: number }>()
const typeName = useCmsEditingLabel('button')
</script>

<template>
  <div class="kit-card-item kit-card-button" :class="[`kit-card-${block.size}`, block.state ? 'kit-card-ghost' : '', block.sample ? 'kit-card-sample' : '']" :data-kit-card-state="block.state">
    <span v-if="block.state" class="kit-card-ghost-btn" aria-hidden="true">
      <span v-if="block.label" v-bind="cmsField('label')">{{ block.label }}</span>
      <KitCardChip v-else-if="block.state !== 'label'" :state="block.state" :name="block.name" type="button" />
      <span v-else-if="typeName" class="kit-card-ghost-words" v-bind="cmsField('label')">{{ typeName }}</span>
      <span v-else class="kit-card-chip-bar" />
    </span>
    <KitSectionButton v-else :to="block.sample ? '' : block.href" :external="block.external" :label="block.label" field="label" />
  </div>
</template>
