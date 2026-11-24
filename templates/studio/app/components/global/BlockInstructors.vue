<script setup lang="ts">
// Block "instructors": the people who teach. Drawn by components/<look>/Instructors.vue.
defineProps<{ block: BlockOf<'instructors'>; index?: number }>()
// (both asked for before the first wait: after one, Nuxt no longer knows which request this is)
const [instructors, kinds] = await Promise.all([useInstructors(), useKinds()])
</script>

<template>
  <LookPart part="Instructors" :first="index === 0" :block="block" :instructors="instructors" :kinds="kinds" :anchor="anchorOf('instructors')" />
</template>
