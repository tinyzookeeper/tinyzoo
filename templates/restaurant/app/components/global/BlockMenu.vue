<script setup lang="ts">
// Block "menu": the dishes by their sections. Drawn by components/<look>/Menu.vue.
defineProps<{ block: BlockOf<'menu'>; index?: number }>()
// All asked for before the first wait: after one, Nuxt no longer knows which request this is.
const [categories, dishes] = await Promise.all([useMenuCategories(), useDishes()])
const sections = computed(() => menuSections(categories.value, dishes.value))
</script>

<template>
  <LookPart part="Menu" :first="index === 0" :block="block" :sections="sections" :anchor="anchorOf('menu')" />
</template>
