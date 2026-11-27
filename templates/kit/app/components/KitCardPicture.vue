<script setup lang="ts">
// A picture of a card (BlockSectionList), drawn by <CmsBlocks prefix="KitCard">: cut to its shape (its
// own when original), with the look's corners. One root element. `side`: the card's first picture,
// which stands at the side in rows. Without a picture (only while editing: a placeholder or the sample
// card) a frame of its shape with a picture icon and, under it, the words or the field's name.
import type { CardPicture } from '../utils/card'

defineProps<{ block: CardPicture; index?: number }>()
</script>

<template>
  <div class="kit-card-item kit-card-picture" :class="[`kit-card-${block.size}`, block.side ? 'kit-card-side' : '', block.state ? 'kit-card-ghost' : '', block.sample ? 'kit-card-sample' : '']" :data-kit-card-state="block.state">
    <CmsImage v-if="block.image && !block.state" :media="block.image" class="kit-card-img" sizes="(min-width: 80rem) 28rem, (min-width: 40rem) 46vw, 100vw" :style="block.ratio ? { aspectRatio: block.ratio } : undefined" />
    <span v-else class="kit-card-ghost-frame" :style="{ aspectRatio: block.ratio ?? '4 / 3' }" aria-hidden="true">
      <svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
      <KitCardChip v-if="block.state" :state="block.state" :name="block.name" type="picture" />
      <span v-else-if="block.name" class="kit-card-chip">{{ block.name }}</span>
    </span>
  </div>
</template>
