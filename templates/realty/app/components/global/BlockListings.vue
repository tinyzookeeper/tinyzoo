<script setup lang="ts">
// Block "listings": the properties as cards under a filter, and the box that watches the offer
// for an e-mail address (the Watchdog form). Drawn by components/<look>/Listings.vue.
const props = defineProps<{ block: BlockOf<'listings'>; index?: number }>()
// (asked for before the first wait: after one, Nuxt no longer knows which request this is)
const [{ listings, total }, watchdog] = await Promise.all([useOffer(), props.block.watchdog ? useSiteForm('watchdog', DEFAULT_LANGUAGE) : null])
// The first listings in the agency's order, as many as the block says (0: all of them).
const shown = computed(() => (props.block.limit ? listings.value.slice(0, props.block.limit) : listings.value))
// The link to the whole offer is left out on the page that already is it (a block that shows all).
const moreUrl = computed(() => (props.block.limit ? '/nabidka' : null))
</script>

<template>
  <LookPart part="Listings" :first="index === 0" :block="block" :listings="shown" :total="total" :watchdog="watchdog" :more-url="moreUrl" :anchor="anchorOf('listings')" />
</template>
