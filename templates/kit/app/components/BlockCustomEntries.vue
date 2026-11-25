<script setup lang="ts">
// Block "custom_entries" (tinyzoo's customTypeBlocks()): a list of the entries of one of the site's
// own types, drawn by the kit for every look (KitEntries). Nothing at all when there is nothing
// to show: no type chosen, a type the site does not have, no entries, a request that failed.
const props = defineProps<{ block: Record<string, any>; index?: number }>()
const custom = await useCustomTypes()
const { plan, cards } = await useCustomBlock(() => props.block, 'entries', custom)
</script>

<template>
  <KitEntries v-if="plan.ok && cards.length" :id="String(block.id ?? index ?? '')" :heading="plan.heading" :text="plan.text" :layout="plan.layout" :cards="cards" />
</template>
