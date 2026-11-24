<script setup lang="ts">
// A category's page (/galerie/svatby): the albums filed under it, drawn like the "All albums"
// block with the category chosen.
import type { Category } from '../lib/cms-content'

const props = defineProps<{ category: Category }>()
const all = await useAlbums()
const categories = await useCategories()
const albums = computed(() => all.value.filter((a) => a.category?.id === props.category.id))
</script>

<template>
  <LookPart part="Albums" first :eyebrow="null" :heading="category.name" :text="category.description" :albums="albums" :categories="categories" :active="category.id" />
</template>
