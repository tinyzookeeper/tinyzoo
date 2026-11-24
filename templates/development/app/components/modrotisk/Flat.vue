<script setup lang="ts">
// The page of one flat in Blueprint: its number set very large and thin, the facts on a
// dimension chain, the floor plan in its print frame, and the way to ask about it.
import type { Flat } from '../../lib/cms-content'

const props = defineProps<{ entry: Flat }>()
const words = useSiteWords()
const w = words.value.flatPage
const { asked } = useFlatBrowser()
const flat = computed(() => props.entry)
const contact = `/#${anchorOf('enquiry')}`
const open = computed(() => flat.value.state !== 'sold')
const isPdf = computed(() => flat.value.plan?.mime === 'application/pdf')
</script>

<template>
  <article>
    <section class="wrap pt-8 lg:pt-14">
      <NuxtLink :to="`/#${anchorOf('pricelist')}`" class="label inline-flex items-center gap-2 min-h-11"><UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />{{ w.back }}</NuxtLink>
      <div class="mt-4 grid lg:grid-cols-12 gap-x-12 gap-y-9 items-end">
        <div class="lg:col-span-6">
          <p class="label">{{ words.flat }} · {{ words.floorNp(flat.floor) }}</p>
          <h1 class="mt-4 font-extralight! text-[5.2rem] sm:text-[7rem] xl:text-[9.6rem] leading-[0.86]! tracking-[-0.045em]! num">{{ flat.number }}</h1>
          <p v-if="flat.note" class="mt-7 max-w-[30rem] text-[1.08rem] text-quiet">{{ tidyText(flat.note) }}</p>
          <p class="mt-6 text-[0.94rem]"><span class="st" :class="`st-${flat.state}`" />{{ words.states[flat.state] }}</p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink v-if="open" :to="contact" class="btn" @click="asked = flat.number">{{ w.ask }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
            <p v-else class="text-quiet">{{ w.soldNote }}</p>
          </div>
        </div>
        <figure class="lg:col-span-6">
          <div class="frame aspect-[3/2] flex items-center justify-center">
            <CmsImage v-if="flat.plan && !isPdf" :media="flat.plan" :alt="`${w.plan} ${flat.number}`" sizes="(min-width: 1024px) 40rem, 100vw" class="object-contain" />
            <div v-else class="p-6 text-center">
              <a v-if="flat.plan" :href="flat.plan.url" class="btn btn-line" target="_blank" rel="noopener"><UIcon name="i-lucide-file-down" class="size-4" aria-hidden="true" />{{ w.planDownload }}</a>
              <p v-else class="text-quiet max-w-[18rem]">{{ w.planByMail }}</p>
            </div>
          </div>
          <figcaption class="cap"><span>{{ w.plan }}</span><span>{{ words.flat }} {{ flat.number }}</span></figcaption>
        </figure>
      </div>

      <dl class="chain mt-12 lg:mt-16 grid grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-4 gap-y-8">
        <div><dt class="label">{{ w.layout }}</dt><dd class="mt-1 font-display font-light text-[1.6rem] sm:text-[2.5rem] lg:text-[3.1rem] leading-none tracking-tight">{{ flat.layout }}</dd></div>
        <div><dt class="label">{{ w.area }}</dt><dd class="mt-1 font-display font-light text-[1.6rem] sm:text-[2.5rem] lg:text-[3.1rem] leading-none tracking-tight num">{{ areaText(flat.area) }}</dd></div>
        <div><dt class="label">{{ w.outdoor }}</dt><dd class="mt-1 font-display font-light text-[1.6rem] sm:text-[2.5rem] lg:text-[3.1rem] leading-none tracking-tight num">{{ flat.outdoorKind === 'none' ? '—' : areaText(flat.outdoorArea) }}</dd><dd v-if="flat.outdoorKind !== 'none'" class="mt-2 text-[0.94rem] text-quiet">{{ words.outdoor[flat.outdoorKind] }}</dd></div>
        <div><dt class="label">{{ w.price }}</dt><dd class="mt-1 font-display font-light text-[1.6rem] sm:text-[2.5rem] lg:text-[3.1rem] leading-none tracking-tight num whitespace-nowrap">{{ flat.state === 'sold' || flat.price == null ? '—' : priceText(flat.price) }}</dd></div>
      </dl>
      <dl class="mt-12 border-t border-line max-w-3xl">
        <div class="flex justify-between gap-4 py-3 border-b" style="border-color:var(--line-soft)"><dt class="text-quiet">{{ w.floor }}</dt><dd class="num font-medium">{{ words.floorNp(flat.floor) }}</dd></div>
        <div class="flex justify-between gap-4 py-3 border-b" style="border-color:var(--line-soft)"><dt class="text-quiet">{{ w.orientation }}</dt><dd class="font-medium">{{ words.orientation[flat.orientation] }}</dd></div>
        <div class="flex justify-between gap-4 py-3 border-b" style="border-color:var(--line-soft)"><dt class="text-quiet">{{ w.sun }}</dt><dd class="font-medium">{{ words.sun[flat.orientation] }}</dd></div>
      </dl>
    </section>
    <div class="pb-24 lg:pb-32" />
  </article>
</template>
