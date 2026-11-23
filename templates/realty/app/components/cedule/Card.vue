<script setup lang="ts">
// Cedule's listing card: one cell of the ruled sheet. The photograph with its state stamped
// in a corner, then the deal in mono, the price set largest, the title, the place and a line
// of parameters in mono. (On a phone the photograph stands beside the text.)
import type { Listing } from '~/lib/cms-content'

const props = defineProps<{ listing: Listing }>()
const words = useSiteWords()
const w = words.value.cedule
const l = computed(() => props.listing)
const cover = computed(() => l.value.photos[0] ?? null)
const sqm = (n: number | null) => (n ? `${formatPrice(n)} m²` : '')
/** The mono line: layout, area and plot or floor; a plot says its area and its price per m². */
const line = computed(() => {
  const x = l.value
  if (x.kind === 'plot') return [sqm(x.landArea), pricePerM2(x)]
  return [x.layout, sqm(x.area), x.kind === 'flat' ? (x.floor != null ? w.facts.floor(x.floor) : '') : x.landArea ? `${w.facts.land} ${sqm(x.landArea)}` : '']
})
</script>

<template>
  <NuxtLink class="listing" :class="{ 'is-sold-card': l.state === 'sold' }" :to="`/nabidka/${l.slug}`" data-card :data-deal="l.deal" :data-kind="l.kind">
    <span class="ph">
      <CmsImage v-if="cover" :media="cover" sizes="(min-width: 1280px) 24rem, (min-width: 1024px) 30rem, (min-width: 640px) 50vw, 40vw" />
      <span v-if="l.state !== 'none'" class="state" :class="`is-${l.state}`">{{ words.state[l.state] }}</span>
    </span>
    <span class="body">
      <span class="mono caps soft">{{ words.deal[l.deal] }}{{ w.sep }}{{ words.kind[l.kind] }}</span>
      <span class="price mt-2" :class="{ soft: l.state === 'sold' }">{{ priceKc(l.price) }} <span v-if="l.deal === 'rent'" class="mono font-normal tracking-normal">{{ w.perMonth }}</span></span>
      <h3 class="mt-2 text-[1.02rem] font-bold leading-[1.25] tracking-[-0.01em]">{{ tidyText(l.title) }}</h3>
      <span class="text-[0.92rem] soft">{{ placeOf(l) }}</span>
      <span class="mono num mt-auto pt-3">{{ line.filter(Boolean).join(' · ') }}</span>
    </span>
  </NuxtLink>
</template>
