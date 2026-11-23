<script setup lang="ts">
// Block "enquiry": the Enquiry form of cms.config.ts beside the contacts from Site settings.
// The messages arrive in the admin (Enquiries). Drawn by components/<look>/Enquiry.vue.
defineProps<{ block: BlockOf<'enquiry'>; index?: number }>()
const form = await useSiteForm('enquiry', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Enquiry" :first="index === 0" :block="block" :form="form" />
</template>
