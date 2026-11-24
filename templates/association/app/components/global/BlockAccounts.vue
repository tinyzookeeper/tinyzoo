<script setup lang="ts">
// Block "accounts": the money strips, the documents by year and the supporters. Drawn by components/<look>/Accounts.vue.
defineProps<{ block: BlockOf<'accounts'>; index?: number }>()
// All asked for before the first wait: after one, Nuxt no longer knows which request this is.
const [documents, supporters] = await Promise.all([useDocuments(), useSupporters()])
</script>

<template>
  <LookPart part="Accounts" :first="index === 0" :block="block" :documents="documents" :supporters="supporters" :anchor="anchorOf('accounts')" />
</template>
