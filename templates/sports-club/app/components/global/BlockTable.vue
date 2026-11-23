<script setup lang="ts">
// Block "table": the league table. In Zpravodaj, straight after the fixtures, it is drawn by the
// fixtures' own part (beside them); everywhere else by components/<look>/Table.vue.
const props = defineProps<{ block: BlockOf<'table'>; index?: number }>()
const [sections, look, table] = await Promise.all([usePageSections(), useLookId(), useTable()])
const drawnByFixtures = computed(() => look.value === 'zpravodaj' && sections.value[(props.index ?? 0) - 1]?.type === 'fixtures')
</script>

<template>
  <LookPart v-if="!drawnByFixtures" part="Table" :first="index === 0" :block="block" :table="table" :anchor="anchorOf('table')" />
</template>
