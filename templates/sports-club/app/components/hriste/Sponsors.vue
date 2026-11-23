<script setup lang="ts">
// Hřiště's partners: the main ones as two large soft cards, the partners as a grid of smaller
// ones, the supporters as a line of names.
import type { Sponsor } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'sponsors'>; first?: boolean; anchor?: string; items: Sponsor[] }>()
const words = useSiteWords()
const of = (level: Sponsor['level']) => props.items.filter((s) => s.level === level)
const main = computed(() => of('main'))
const partners = computed(() => of('partner'))
const supporters = computed(() => of('supporter'))
const attrs = (s: Sponsor) => (s.url ? { href: siteHref(s.url), target: isExternal(s.url) ? '_blank' : undefined, rel: isExternal(s.url) ? 'noopener' : undefined } : {})
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-28">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
      <component :is="first ? 'h1' : 'h2'" class="disp h2"><span class="slash" aria-hidden="true" /><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="max-w-md text-quiet lg:pb-1">{{ tidyText(block.text) }}</p>
    </div>
    <ul v-if="main.length" class="mt-6 grid gap-3 sm:grid-cols-2 lg:mt-8 lg:gap-4">
      <li v-for="s in main" :key="s.id">
        <component :is="s.url ? 'a' : 'div'" v-bind="attrs(s)" class="flex min-h-[132px] flex-col justify-between gap-4 rounded-3xl bg-tint p-6 transition-colors hover:bg-line lg:min-h-[168px] lg:p-8"><span class="eyebrow">{{ words.levelOne.main }}</span><span class="disp text-[30px] lg:text-[40px]">{{ s.name }}</span></component>
      </li>
    </ul>
    <ul v-if="partners.length" class="mt-3 grid grid-cols-2 gap-3 lg:mt-4 lg:grid-cols-4 lg:gap-4">
      <li v-for="s in partners" :key="s.id"><component :is="s.url ? 'a' : 'div'" v-bind="attrs(s)" class="flex h-full min-h-[84px] items-center rounded-2xl bg-tint px-5 py-4 font-display text-[18px] font-extrabold leading-tight transition-colors hover:bg-line lg:text-[20px]">{{ s.name }}</component></li>
    </ul>
    <div v-if="supporters.length" class="mt-7 grid gap-x-10 gap-y-2 md:grid-cols-[9rem_1fr]">
      <p class="eyebrow md:pt-3.5">{{ words.levelOne.supporter }}</p>
      <p class="flex flex-wrap gap-x-6 text-[16.5px]"><component :is="s.url ? 'a' : 'span'" v-for="s in supporters" :key="s.id" v-bind="attrs(s)" class="inline-flex min-h-11 items-center transition-colors hover:text-brand">{{ s.name }}</component></p>
    </div>
  </section>
</template>
