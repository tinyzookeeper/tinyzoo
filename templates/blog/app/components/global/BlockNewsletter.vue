<script setup lang="ts">
// Block "newsletter": the most read articles and the sign-up (the Newsletter form of
// cms.config.ts). The sign-ups arrive in the admin. Drawn by components/<look>/Newsletter.vue.
defineProps<{ block: BlockOf<'newsletter'>; index?: number }>()
const articles = await useArticles()
const form = await useSiteForm('newsletter', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Newsletter" :first="index === 0" :block="block" :articles="articles" :form="form" :anchor="anchorOf('newsletter')" />
</template>
