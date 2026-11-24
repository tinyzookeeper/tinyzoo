<script setup lang="ts">
// Block "enquiry": the salesperson and the form (the Enquiry form of cms.config.ts). The enquiries
// arrive in the admin. Drawn by components/<look>/Enquiry.vue, its fields by <EnquiryFields>.
defineProps<{ block: BlockOf<'enquiry'>; index?: number }>()
const [form, flats] = await Promise.all([useSiteForm('enquiry', DEFAULT_LANGUAGE), useFlats()])
</script>

<template>
  <LookPart part="Enquiry" :first="index === 0" :index="index" :block="block" :form="form" :flats="flats" :anchor="anchorOf('enquiry')" />
</template>
