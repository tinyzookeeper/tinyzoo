<script setup lang="ts">
// Block "contact": only the contact form, for a page of its own. Drawn by components/<look>/Contact.vue.
defineProps<{ block: BlockOf<'contact'>; index?: number }>()
const form = await useSiteForm('contact', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Contact" :first="index === 0" :block="block" :form="form" :anchor="anchorOf('contact')" />
</template>
