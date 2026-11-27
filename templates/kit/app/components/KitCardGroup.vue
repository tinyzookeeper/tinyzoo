<script setup lang="ts">
// A group of a card (BlockSectionList), drawn by <CmsBlocks prefix="KitCard">: one block of the card's
// list, and itself the container of its own small blocks (a row or a stack). It holds no group
// (cardListPlan leaves one out). One root element: the container. Empty (only while editing): a dashed box.
import type { CardGroup } from '../utils/card'

const props = defineProps<{ block: CardGroup; index?: number }>()
const classes = computed(() => ['kit-card-item', 'kit-card-group', `kit-card-${props.block.size}`, 'kit-card-list', `kit-card-list-${props.block.arrangement}`, `kit-card-gap-${props.block.space}`, ...(props.block.empty ? ['kit-card-ghost-list'] : []), ...(props.block.sample ? ['kit-card-sample'] : [])])
</script>

<template>
  <div :class="classes" :data-kit-card-state="block.state">
    <CmsBlocks :blocks="block.items" prefix="KitCard" />
  </div>
</template>
