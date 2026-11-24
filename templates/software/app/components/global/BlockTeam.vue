<script setup lang="ts">
// Block "team": who makes the product, where the data is, how to reach support, and the contact
// form (the Contact form of cms.config.ts; the messages arrive in the admin). Drawn by
// components/<look>/Team.vue, the form's fields by <ContactFields>.
defineProps<{ block: BlockOf<'team'>; index?: number }>()
const form = await useSiteForm('contact', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Team" :first="index === 0" :block="block" :form="form" :anchor="anchorOf('team')" />
</template>
