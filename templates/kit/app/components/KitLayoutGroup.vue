<script setup lang="ts">
// A group of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: one
// block of the section's list, and itself the container of its own small blocks (a stack or a row).
// It holds no group (layoutPlan leaves one out). One root element: the container.
import type { LayoutGroup } from '../utils/layout'

const props = defineProps<{ block: LayoutGroup; index?: number }>()
const classes = computed(() => ['kit-lay-item', 'kit-lay-group', `kit-lay-${props.block.size}`, ...layoutClasses(props.block)])
</script>

<template>
  <div :class="classes">
    <CmsBlocks :blocks="block.items" prefix="KitLayout" />
  </div>
</template>
