<script setup lang="ts">
// Block "jobs": the jobs marked for the home page (or all of them), from the Jobs section.
// `total` is the count of every job, for the link to the page of all of them.
// Drawn by components/<look>/Jobs.vue.
const props = defineProps<{ block: BlockOf<'jobs'>; index?: number }>()
const all = await useJobs()
const jobs = computed(() => jobsShown(props.block, all.value))
</script>

<template>
  <LookPart part="Jobs" :first="index === 0" :block="block" :jobs="jobs" :total="all.length" :anchor="anchorOf('jobs')" />
</template>
