<script setup lang="ts">
// Block "season": the seasonal offers that are valid today (between their dates, both included).
// None valid: nothing is drawn. Drawn by components/<look>/Season.vue, once for each offer.
defineProps<{ block: BlockOf<'season'>; index?: number }>()
const now = useSiteNow()
const offers = await useOffers()
const active = computed(() => offers.value.filter((o) => isSeasonOn(o, now.value)))
</script>

<template>
  <LookPart v-for="(offer, i) in active" :key="offer.id" part="Season" :first="index === 0 && i === 0" :offer="offer" :anchor="i === 0 ? anchorOf('season') : undefined" />
</template>
