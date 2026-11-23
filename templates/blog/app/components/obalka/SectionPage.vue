<script setup lang="ts">
// A section's page (/rubrika/lide): its name and description, then its articles as the contents list.
import type { Section } from '~/lib/cms-content'

const props = defineProps<{ entry: Section }>()
const { words } = await useBlog()
const articles = await useArticles()
const items = computed(() => inSection(articles.value, props.entry))
</script>

<template>
  <ObalkaList first :block="{ heading: entry.name, text: entry.description }" :items="items" />
  <p v-if="!items.length" class="wrap pb-20 font-display text-[1.2rem]">{{ words.noArticles }}</p>
</template>
