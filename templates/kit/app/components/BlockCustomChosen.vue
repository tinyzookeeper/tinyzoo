<script setup lang="ts">
// Block "custom_chosen" (tinyzoo's customTypeBlocks()): entries of one of the site's own types, picked
// by hand, in the picked order, drawn by the kit for every look (KitEntries). An entry that is
// gone is left out; nothing at all when none is left.
const props = defineProps<{ block: Record<string, any>; index?: number }>()
const custom = await useCustomTypes()
const { plan, cards } = await useCustomBlock(() => props.block, 'chosen', custom)
const table = computed(() => (plan.value.ok && plan.value.layout === 'table' ? customTable(cards.value, plan.value, { lang: custom.lang }) : undefined))
</script>

<template>
  <KitEntries v-if="plan.ok && cards.length" :id="String(block.id ?? index ?? '')" :heading="plan.heading" :text="plan.text" :layout="plan.layout" :columns="plan.columns" :picture="plan.picture" :cards="cards" :table="table" />
</template>
