<script setup lang="ts">
// Block "results": the winners of one year, or every row. Drawn by components/<look>/Results.vue.
const props = defineProps<{ block: BlockOf<'results'>; index?: number }>()
const results = await useResults()
const groups = computed(() => groupResults(results.value, props.block.year, props.block.all))
</script>

<template>
  <LookPart part="Results" :first="index === 0" :block="block" :groups="groups" :anchor="anchorOf('results')" />
</template>
