<script setup lang="ts">
// Block "opening" (cms.config.ts), drawn by the site's look: components/<look>/Opening.vue.
// It also knows what lunch costs today ("from 149 Kč"), which Plate and Receipt print beside the headline.
defineProps<{ block: BlockOf<'opening'>; index?: number }>()
const menus = await useDailyMenus()
const now = useNow()
const from = computed(() => lunchFrom(lunchOf(menus.value, now.value)?.menu))
</script>

<template>
  <LookPart part="Opening" :first="index === 0" :block="block" :from="from" :anchor="anchorOf('opening')" />
</template>
