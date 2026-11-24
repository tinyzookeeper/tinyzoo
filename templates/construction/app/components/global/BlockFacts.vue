<script setup lang="ts">
// Block "facts", drawn by the site's look: components/<look>/Facts.vue. Zdivo lays it flush
// against the opening when it follows it.
const props = defineProps<{ block: BlockOf<'facts'>; index?: number }>()
const sections = await usePageSections()
const afterHero = computed(() => !!props.index && sections.value[props.index - 1]?.type === 'hero')
</script>

<template>
  <LookPart part="Facts" :first="index === 0" :block="block" :after-hero="afterHero" />
</template>
