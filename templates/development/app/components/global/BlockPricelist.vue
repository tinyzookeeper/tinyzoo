<script setup lang="ts">
// Block "pricelist": the flats with a filter. Blueprint draws its elevation above the list unless
// the page has a block of its own for the building at a glance. Drawn by components/<look>/Pricelist.vue.
defineProps<{ block: BlockOf<'pricelist'>; index?: number }>()
// All asked for before the first wait: after one, Nuxt no longer knows which request this is.
const [flats, floors, sections] = await Promise.all([useFlats(), useFloors(), usePageSections()])
const withOverview = computed(() => sections.value.some((s) => s.type === 'overview'))
</script>

<template>
  <LookPart part="Pricelist" :first="index === 0" :index="index" :block="block" :flats="flats" :floors="floors" :with-overview="withOverview" :anchor="anchorOf('pricelist')" />
</template>
