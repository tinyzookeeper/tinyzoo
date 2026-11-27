<script setup lang="ts">
// A text of a card (BlockSectionList), drawn by <CmsBlocks prefix="KitCard">: a rich text in the look's
// .prose-look, or a plain text (a value of the entry, several lines kept) with the words before and
// after a number. One root element. A text that shows nothing (only while editing) is a placeholder.
// A text with its own text is marked for the editor in the preview (cmsField).
import type { CardText } from '../utils/card'

defineProps<{ block: CardText; index?: number }>()
</script>

<template>
  <div class="kit-card-item kit-card-text prose-look" :class="[`kit-card-${block.size}`, `kit-card-t-${block.scale}`, block.state ? 'kit-card-ghost' : '', block.sample ? 'kit-card-sample' : '']" :data-kit-card-state="block.state">
    <KitCardChip v-if="block.state" :state="block.state" :name="block.name" type="text" />
    <CmsContent v-else-if="block.doc" :doc="block.doc" class="kit-card-rich prose-look" />
    <p v-else class="kit-card-p"><template v-if="block.before"><span v-bind="cmsField('before')">{{ block.before }}</span>&nbsp;</template><span v-bind="block.text !== undefined ? cmsField('text') : {}">{{ block.shown }}</span><template v-if="block.after">&nbsp;<span v-bind="cmsField('after')">{{ block.after }}</span></template></p>
  </div>
</template>
