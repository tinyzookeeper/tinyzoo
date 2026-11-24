<script setup lang="ts">
// A link as the content gives it: an address of the site (a page, `/#kontakt`) or a web address
// that opens in a new tab.
defineProps<{ to: string | null | undefined }>()
</script>

<template>
  <a v-if="isExternal(to)" :href="to ?? ''" target="_blank" rel="noopener"><slot /></a>
  <NuxtLink v-else :to="siteHref(to)"><slot /></NuxtLink>
</template>
