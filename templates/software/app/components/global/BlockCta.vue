<script setup lang="ts">
// Block "cta" (cms.config.ts), drawn by the site's look: components/<look>/Cta.vue. The e-mail field is the Trial form of cms.config.ts; the addresses arrive in the admin.
defineProps<{ block: BlockOf<'cta'>; index?: number }>()
const form = await useSiteForm('trial', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Cta" :first="index === 0" :block="block" :anchor="anchorOf('cta')" :form="form" />
</template>
