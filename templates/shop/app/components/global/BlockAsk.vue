<script setup lang="ts">
// Block "ask": the enquiry form (the Enquiry form of cms.config.ts) and the gift vouchers. The
// enquiries arrive in the admin. Drawn by components/<look>/Ask.vue.
defineProps<{ block: BlockOf<'ask'>; index?: number }>()
const form = await useSiteForm('enquiry', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Ask" :first="index === 0" :block="block" :form="form" :anchor="anchorOf('ask')" />
</template>
