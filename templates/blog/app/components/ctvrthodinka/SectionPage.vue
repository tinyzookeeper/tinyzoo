<script setup lang="ts">
// A section's page (/rubrika/lide): its name and description, then its articles as the staircase.
import type { Section } from '~/lib/cms-content'

const props = defineProps<{ entry: Section }>()
const { words } = await useBlog()
const articles = await useArticles()
const items = computed(() => [...inSection(articles.value, props.entry)].sort((a, b) => minutesOf(a) - minutesOf(b)))
</script>

<template>
  <CtvrthodinkaList first :block="{ heading: entry.name, text: entry.description }" :items="items" />
  <p v-if="!items.length" class="wrap pb-20 text-[1.2rem] font-medium">{{ words.noArticles }}</p>
</template>
