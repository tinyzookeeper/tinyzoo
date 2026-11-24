<script setup lang="ts">
// Po slunci's opening: on the soft ground the sentence about the sun, the visualisation under a
// dotted path of the sun from east over south to west, and the four key facts on a white card.
import type { Flat } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; flats: Flat[] }>()
const { settings, name } = await useSite()
const words = useSiteWords()
const c = words.value.poSlunci.compass
const headline = computed(() => props.block.headline || name.value)
const size = computed(() => byLength(headline.value, [
  [48, 'text-[2.75rem] sm:text-[3.5rem] xl:text-[4.5rem]'],
  [90, 'text-[2.4rem] sm:text-[3rem] xl:text-[3.6rem]'],
], 'text-[2rem] sm:text-[2.5rem] xl:text-[3rem]'))
const facts = computed(() => keyFacts(props.block.facts, props.flats, settings.value, words.value, { range: '–', areaFromTo: false, monthNumbers: false, alwaysYear: false, millions: true }))
// The borders between the cells of the card: a dotted rule on the right, and under the first row on a phone.
const BORDERS = ['border-b lg:border-b-0 border-r border-dotted', 'border-b lg:border-b-0 lg:border-r border-dotted', 'border-r border-dotted', 'border-dotted']
</script>

<template>
  <div :id="anchor" class="bg-soft">
    <section class="wrap pt-8 lg:pt-12 pb-12 lg:pb-16">
      <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10 items-center">
        <div class="lg:col-span-6">
          <component :is="first ? 'h1' : 'h2'" :class="size"><span v-if="block.eyebrow" class="block italic text-brand text-[0.52em] mb-3">{{ block.eyebrow }}</span>{{ tidyText(headline) }}</component>
          <p v-if="block.text" class="mt-6 max-w-[31rem] text-[1.1rem] text-quiet">{{ tidyText(block.text) }}</p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-down" class="size-[1.125rem]" aria-hidden="true" /></NuxtLink>
            <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="siteHref(block.secondaryUrl)" class="btn btn-ghost">{{ block.secondaryLabel }}</NuxtLink>
          </div>
        </div>
        <!-- the path of the sun above the house: from the east over the south to the west -->
        <div class="lg:col-span-6 relative aspect-[600/490]">
          <svg class="absolute inset-0 w-full h-full" viewBox="0 0 600 490" fill="none" aria-hidden="true">
            <path d="M14 322a286 286 0 0 1 572 0" stroke="var(--brand)" stroke-opacity=".55" stroke-width="2.5" stroke-dasharray="1 11" stroke-linecap="round" />
          </svg>
          <span class="absolute left-[2.3%] top-[65.7%] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-paper text-ink text-[0.84rem] font-bold flex items-center justify-center" :title="c.east[1]">{{ c.east[0] }}</span>
          <span class="absolute left-1/2 top-[7.3%] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-paper text-ink text-[0.84rem] font-bold flex items-center justify-center" :title="c.south[1]">{{ c.south[0] }}</span>
          <span class="absolute left-[97.7%] top-[65.7%] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-paper text-ink text-[0.84rem] font-bold flex items-center justify-center" :title="c.west[1]">{{ c.west[0] }}</span>
          <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 38rem, 90vw" class="photo absolute left-[7%] top-[24.5%] w-[86%]! h-auto! aspect-[3/2]" />
          <span class="absolute left-[80.6%] top-[21%] -translate-x-1/2 -translate-y-1/2 w-[13%] aspect-square rounded-full bg-sun" style="box-shadow: 0 0 0 7px color-mix(in srgb, var(--sun) 35%, transparent)" aria-hidden="true" />
        </div>
      </div>

      <!-- key facts -->
      <dl v-if="facts.length" class="mt-12 lg:mt-14 bg-paper rounded-[1.5rem] grid grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-4">
        <div v-for="(fact, i) in facts" :key="i" class="px-5 lg:px-8 py-5 lg:py-7" :class="i === facts.length - 1 ? '' : BORDERS[i]" style="border-color:var(--dash)">
          <dt class="text-[0.9rem] font-semibold text-quiet">{{ fact.label }}</dt>
          <dd class="mt-1 serif text-[1.6rem] sm:text-[2.2rem] lg:text-[2.7rem] leading-tight text-brand" :class="fact.kind === 'flats' ? 'num' : fact.kind === 'price' ? 'num whitespace-nowrap' : 'whitespace-nowrap'">{{ fact.value }}<template v-if="fact.unit">{{ ' ' }}<span class="text-[0.6em]">{{ fact.unit }}</span></template></dd>
          <dd v-if="fact.note" class="text-[0.9rem] text-quiet">{{ fact.note }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
