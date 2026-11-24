<script setup lang="ts">
// Block "enquiry": the form a guest sends to ask whether a date is free (the Enquiry form of
// cms.config.ts). The enquiries arrive in the admin. Drawn by components/<look>/Enquiry.vue.
defineProps<{ block: BlockOf<'enquiry'>; index?: number }>()
// All asked for before the first wait: after one, Nuxt no longer knows which request this is.
const [rooms, form] = await Promise.all([useRooms(), useSiteForm('enquiry', DEFAULT_LANGUAGE)])
</script>

<template>
  <LookPart part="Enquiry" :first="index === 0" :block="block" :form="form" :rooms="rooms" :anchor="anchorOf('enquiry')" />
</template>
