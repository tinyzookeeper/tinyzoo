<script setup lang="ts">
// Block "cases": the case studies, each with a page of its own. Drawn by components/<look>/Cases.vue.
const props = defineProps<{ block: BlockOf<'cases'>; index?: number }>()
const all = await useCases()
const items = computed(() => (props.block.count ? all.value.slice(0, props.block.count) : all.value))
</script>

<template>
  <LookPart part="Cases" :first="index === 0" :block="block" :anchor="anchorOf('cases')" :items="items" />
</template>
