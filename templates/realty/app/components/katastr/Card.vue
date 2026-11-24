<script setup lang="ts">
// Katastr's listing card: a photograph with its state in a corner, the deal and the number of
// the listing like a record's header, a serif title, the price and a ruled record of three
// cells (layout, area, plot or floor).
import type { Listing } from '~/lib/cms-content'

const props = defineProps<{ listing: Listing }>()
const words = useSiteWords()
const w = words.value.katastr
const l = computed(() => props.listing)
const cover = computed(() => l.value.photos[0] ?? null)
const sqm = (n: number | null) => (n ? `${formatPrice(n)}\u00A0m²` : '')
/** Three cells: what a property of this kind is best told by. A plot has no layout: its first two parameters stand there. */
const facts = computed(() => {
  const x = l.value
  const cells: Array<{ label: string; value: string }> = []
  const add = (label: string, value: string | null | undefined) => { if (value) cells.push({ label, value }) }
  if (x.kind === 'plot') {
    add(x.extras[0]?.label ?? '', x.extras[0]?.value)
    add(w.facts.area, sqm(x.landArea))
    add(x.extras[1]?.label ?? '', x.extras[1]?.value)
    return cells
  }
  add(w.facts.layout, x.layout)
  add(w.facts.area, sqm(x.area))
  if (x.kind === 'flat') add(w.facts.floor, floorOf(x.floor, x.floorsTotal, words.value))
  else add(w.facts.land, sqm(x.landArea))
  return cells
})
</script>

<template>
  <NuxtLink class="listing" :class="{ 'is-sold-card': l.state === 'sold' }" :to="`/nabidka/${l.slug}`" data-card :data-deal="l.deal" :data-kind="l.kind">
    <span class="ph">
      <CmsImage v-if="cover" :media="cover" sizes="(min-width: 1024px) 26rem, (min-width: 640px) 45vw, 92vw" />
      <span v-if="l.state !== 'none'" class="state label" :class="`is-${l.state}`">{{ words.state[l.state] }}</span>
    </span>
    <span class="mt-4 flex justify-between label text-quiet"><span>{{ words.deal[l.deal] }} · {{ words.kind[l.kind] }}</span><span v-if="l.code" class="num">{{ w.no(l.code) }}</span></span>
    <h3 class="mt-2">{{ tidyText(l.title) }}</h3>
    <span class="mt-1 flex items-center gap-1.5 text-[0.95rem]"><UIcon name="i-lucide-map-pin" class="ic text-quiet" aria-hidden="true" />{{ placeOf(l) }}</span>
    <span class="mt-4 serif text-ink text-[1.7rem] leading-none num" :class="{ '!text-quiet': l.state === 'sold' }">{{ priceKc(l.price) }} <span v-if="l.priceUnit" class="font-sans text-[0.95rem] text-quiet">{{ tidyText(l.priceUnit) }}</span></span>
    <dl class="spec mt-4 text-[0.95rem]"><div v-for="c in facts" :key="c.label"><dt>{{ c.label }}</dt><dd>{{ c.value }}</dd></div></dl>
  </NuxtLink>
</template>
