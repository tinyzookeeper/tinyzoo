<script setup lang="ts">
// Rozsvíceno's listing card: a rounded card with the photograph inset (the state in a pill on
// its corner), the deal in quiet type, the title and place, the parameters as pills and the
// price in the lamp colour beside a round arrow.
import type { Listing } from '~/lib/cms-content'

const props = defineProps<{ listing: Listing }>()
const words = useSiteWords()
const w = words.value.rozsviceno
const l = computed(() => props.listing)
const cover = computed(() => l.value.photos[0] ?? null)
const sqm = (n: number | null) => (n ? `${formatPrice(n)}\u00A0m²` : '')
/** The pills: layout, area and garden or floor; a plot says its area, its price per m² and its second parameter ("sítě na hranici"). */
const pills = computed(() => {
  const x = l.value
  if (x.kind === 'plot') return [sqm(x.landArea), pricePerM2(x), x.extras[1] ? `${x.extras[1].label.toLowerCase()} ${x.extras[1].value}` : '']
  return [x.layout, sqm(x.area), x.kind === 'flat' ? (x.floor != null ? w.facts.floor(x.floor) : '') : x.landArea ? `${w.facts.land} ${sqm(x.landArea)}` : '']
})
</script>

<template>
  <NuxtLink class="listing h-full" :class="{ 'is-sold-card': l.state === 'sold' }" :to="`/nabidka/${l.slug}`" data-card :data-deal="l.deal" :data-kind="l.kind">
    <span class="ph">
      <CmsImage v-if="cover" :media="cover" sizes="(min-width: 1024px) 26rem, (min-width: 768px) 45vw, 82vw" />
      <span v-if="l.state !== 'none'" class="state" :class="`is-${l.state}`">{{ words.state[l.state] }}</span>
    </span>
    <span class="flex flex-col flex-1 px-3 pt-4 pb-2.5">
      <span class="text-[0.88rem] text-quiet">{{ words.deal[l.deal] }} · {{ words.kind[l.kind].toLowerCase() }}</span>
      <h3 class="mt-1 text-[1.35rem] leading-[1.2]">{{ tidyText(l.title) }}</h3>
      <span class="mt-1.5 flex items-center gap-1.5 text-[0.95rem] text-quiet"><UIcon name="i-lucide-map-pin" class="ic" aria-hidden="true" />{{ placeOf(l) }}</span>
      <span class="mt-4 flex flex-wrap gap-1.5"><span v-for="(p, i) in pills.filter(Boolean)" :key="i" class="pill">{{ p }}</span></span>
      <span class="mt-auto pt-5 flex items-end justify-between gap-3"><span class="fig text-[1.55rem] leading-none" :class="l.state === 'sold' ? 'text-quiet' : 'text-lamp'">{{ priceKc(l.price) }} <span v-if="l.deal === 'rent'" class="font-sans font-normal text-[0.9rem] text-quiet">{{ w.perMonth }}</span></span><span class="go"><UIcon name="i-lucide-arrow-up-right" class="size-5" aria-hidden="true" /></span></span>
    </span>
  </NuxtLink>
</template>
