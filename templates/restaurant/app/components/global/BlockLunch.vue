<script setup lang="ts">
// Block "lunch": today's lunch from the Daily menu section (the next day's when today has none).
// Drawn by components/<look>/Lunch.vue.
defineProps<{ block: BlockOf<'lunch'>; index?: number }>()
const menus = await useDailyMenus()
const now = useNow()
const lunch = computed(() => lunchOf(menus.value, now.value))
</script>

<template>
  <LookPart part="Lunch" :first="index === 0" :block="block" :lunch="lunch" :anchor="anchorOf('lunch')" />
</template>
