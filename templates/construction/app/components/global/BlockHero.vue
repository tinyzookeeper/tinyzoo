<script setup lang="ts">
// Block "hero" (cms.config.ts), drawn by the site's look: components/<look>/Hero.vue. A look
// that sets the facts right under the opening (Zdivo) needs to know that the facts follow.
const props = defineProps<{ block: BlockOf<'hero'>; index?: number }>()
const sections = await usePageSections()
const factsFollow = computed(() => sections.value[(props.index ?? 0) + 1]?.type === 'facts')
</script>

<template>
  <LookPart part="Hero" :first="index === 0" :block="block" :facts-follow="factsFollow" />
</template>
