<script setup lang="ts">
// The page of one flat in Patra: the number in the large serif, the facts as ruled rows, the
// floor plan on a rounded sheet, and the way to ask about it.
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
  [w.orientation, words.value.orientation[flat.value.orientation]],
])
</script>

<template>
  <article class="wrap pt-10 lg:pt-16 pb-24 lg:pb-32">
    <NuxtLink :to="`/#${anchorOf('pricelist')}`" class="navlink text-quiet!"><UIcon name="i-lucide-arrow-left" class="size-4 mr-2" aria-hidden="true" />{{ w.back }}</NuxtLink>
    <div class="mt-4 grid lg:grid-cols-12 gap-x-12 gap-y-10 items-start">
      <div class="lg:col-span-6">
        <p class="label">{{ words.flat }} · {{ words.floorNp(flat.floor) }}</p>
        <h1 class="mt-3 text-[4.4rem] sm:text-[6rem] xl:text-[7.6rem] leading-[0.92]! num">{{ flat.number }}</h1>
        <p class="mt-4"><span class="state" :class="`state-${flat.state}`">{{ words.states[flat.state] }}</span></p>
        <p v-if="flat.note" class="mt-5 text-[1.12rem] text-quiet max-w-[30rem]">{{ tidyText(flat.note) }}</p>
        <p class="mt-8 serif text-[2.9rem] num whitespace-nowrap">{{ flat.state === 'sold' || flat.price == null ? '—' : priceText(flat.price) }}</p>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <NuxtLink v-if="open" :to="contact" class="btn" @click="asked = flat.number">{{ w.ask }} <UIcon name="i-lucide-arrow-right" class="size-[1.0625rem]" aria-hidden="true" /></NuxtLink>
          <p v-else class="text-quiet">{{ w.soldNote }}</p>
        </div>
        <dl class="mt-10 border-t border-line max-w-[30rem]">
          <div v-for="(row, i) in rows" :key="i" class="flex justify-between gap-4 py-3.5 border-b border-line"><dt class="text-quiet">{{ row[0] }}</dt><dd class="font-medium num">{{ row[1] }}</dd></div>
        </dl>
      </div>
      <div class="lg:col-span-6 rounded-[18px] bg-soft p-6 lg:p-8">
        <p class="label">{{ w.plan }}</p>
        <div class="mt-5 aspect-[4/3] rounded-[12px] bg-paper flex items-center justify-center overflow-hidden">
          <CmsImage v-if="flat.plan && !isPdf" :media="flat.plan" :alt="`${w.plan} ${flat.number}`" sizes="(min-width: 1024px) 36rem, 100vw" class="w-full h-full object-contain" />
          <div v-else class="p-6 text-center">
            <a v-if="flat.plan" :href="flat.plan.url" class="btn btn-line" target="_blank" rel="noopener"><UIcon name="i-lucide-file-down" class="size-5" aria-hidden="true" />{{ w.planDownload }}</a>
            <p v-else class="text-quiet max-w-[18rem]">{{ w.planByMail }}</p>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
