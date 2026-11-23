<script setup lang="ts">
// Block "fixtures": the matches of the teams that have a tab. In Zpravodaj the league table that
// follows this block on the page is drawn beside it, as that design has it (BlockTable then draws
// nothing of its own). Drawn by components/<look>/Fixtures.vue.
const props = defineProps<{ block: BlockOf<'fixtures'>; index?: number }>()
// All asked for before the first wait: after one, Nuxt no longer knows which request this is.
const [sections, look, fixtures, table] = await Promise.all([usePageSections(), useLookId(), useFixtures(), useTable()])
const beside = computed(() => {
  const next = sections.value[(props.index ?? -1) + 1]
  return look.value === 'zpravodaj' && next?.type === 'table' ? next : null
})
</script>

<template>
  <LookPart
    part="Fixtures" :first="index === 0" :block="block" :squads="fixtures.squads.value" :matches="fixtures.matches.value"
    :beside="beside" :table="table" :anchor="anchorOf('fixtures')" :table-anchor="anchorOf('table')"
  />
</template>
