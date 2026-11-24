<script setup lang="ts">
// The page of one flat in Po slunci: the number in the serif with the compass of its side and the
// words for when it gets the sun, the facts on rounded rows, the floor plan on a soft card, and the
// round way to ask about it.
import type { Flat } from '~/lib/cms-content'

const props = defineProps<{ entry: Flat }>()
const words = useSiteWords()
const w = words.value.flatPage
const { asked } = useFlatBrowser()
const flat = computed(() => props.entry)
const contact = `/#${anchorOf('enquiry')}`
const open = computed(() => flat.value.state !== 'sold')
const isPdf = computed(() => flat.value.plan?.mime === 'application/pdf')
const rows = computed(() => [
  [w.layout, flat.value.layout], [w.area, areaText(flat.value.area)], [w.floor, words.value.floorNp(flat.value.floor)],
  [w.outdoor, flat.value.outdoorKind === 'none' ? '—' : `${words.value.outdoor[flat.value.outdoorKind]} ${areaText(flat.value.outdoorArea)}`],
])
</script>

<template>
  <article class="bg-soft pb-16 lg:pb-24">
    <section class="wrap pt-4 lg:pt-6">
      <NuxtLink :to="`/#${anchorOf('pricelist')}`" class="navlink"><UIcon name="i-lucide-arrow-left" class="size-4 mr-2" aria-hidden="true" />{{ w.back }}</NuxtLink>
      <div class="mt-6 grid lg:grid-cols-12 gap-x-12 gap-y-10 items-start">
        <div class="lg:col-span-6">
          <p class="eyebrow">{{ words.flat }} · {{ words.floorNp(flat.floor) }}</p>
          <h1 class="mt-2 text-[2.75rem] sm:text-[3.5rem] xl:text-[4.5rem] num">{{ flat.number }}</h1>
          <p class="mt-4 flex items-center gap-1 text-[1.05rem]"><PoSlunciSun :orientation="flat.orientation" /> <strong class="font-semibold">{{ words.orientationCap[flat.orientation] }}</strong> · {{ words.sun[flat.orientation] }}</p>
          <p v-if="flat.note" class="mt-5 max-w-[31rem] text-[1.1rem] text-quiet">{{ tidyText(flat.note) }}</p>
          <p class="mt-6 flex items-center gap-4"><span class="state" :class="`state-${flat.state}`">{{ words.states[flat.state] }}</span><span class="serif text-[2rem] num whitespace-nowrap">{{ flat.state === 'sold' || flat.price == null ? '' : priceText(flat.price) }}</span></p>
          <div class="mt-7 flex flex-wrap items-center gap-3">
            <NuxtLink v-if="open" :to="contact" class="btn" @click="asked = flat.number">{{ w.ask }} <UIcon name="i-lucide-arrow-right" class="size-[1.125rem]" aria-hidden="true" /></NuxtLink>
            <p v-else class="text-quiet">{{ w.soldNote }}</p>
          </div>
          <ul class="mt-8 flex flex-col gap-2.5">
            <li v-for="(row, i) in rows" :key="i" class="flex justify-between gap-4 rounded-2xl bg-paper px-5 py-3.5"><span class="text-quiet">{{ row[0] }}</span><strong class="font-semibold num">{{ row[1] }}</strong></li>
          </ul>
        </div>
        <div class="lg:col-span-6 card bg-paper">
          <p class="font-semibold text-quiet text-[0.9rem]">{{ w.plan }}</p>
          <div class="mt-4 aspect-[4/3] rounded-[1.1rem] bg-soft flex items-center justify-center overflow-hidden">
            <CmsImage v-if="flat.plan && !isPdf" :media="flat.plan" :alt="`${w.plan} ${flat.number}`" sizes="(min-width: 1024px) 36rem, 100vw" class="w-full h-full object-contain" />
            <div v-else class="p-6 text-center">
              <a v-if="flat.plan" :href="flat.plan.url" class="btn btn-ghost" target="_blank" rel="noopener"><UIcon name="i-lucide-file-down" class="size-5" aria-hidden="true" />{{ w.planDownload }}</a>
              <p v-else class="text-quiet max-w-[18rem]">{{ w.planByMail }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </article>
</template>
