<script setup lang="ts">
// Block "contact": the office from Site settings and the form (the Enquiry form). The topics
// the visitor can choose from are the agency's own, listed in the block. Drawn by
// components/<look>/Contact.vue.
const props = defineProps<{ block: BlockOf<'contact'>; index?: number }>()
const form = await useSiteForm('enquiry', DEFAULT_LANGUAGE)
const topics = computed(() => props.block.topics.map((t) => t.name).filter(Boolean))
</script>

<template>
  <LookPart part="Contact" :first="index === 0" :block="block" :form="form" :topics="topics" :anchor="anchorOf('contact')" />
</template>
