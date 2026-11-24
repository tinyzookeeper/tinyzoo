<script setup lang="ts">
// Block "contact": the Message form of cms.config.ts beside the contacts from Site settings.
// The messages arrive in the admin (Messages). Drawn by components/<look>/Contact.vue, its
// fields by <ContactFields>.
defineProps<{ block: BlockOf<'contact'>; index?: number }>()
const form = await useSiteForm('message', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Contact" :first="index === 0" :block="block" :form="form" :anchor="anchorOf('contact')" />
</template>
