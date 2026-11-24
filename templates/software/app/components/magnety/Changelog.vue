<script setup lang="ts">
// Magnets' changelog: a dark section with a question as the heading and a tile for each version
// (the newest in orange): a row to swipe on a phone, five across on a desktop (a page that shows
// every release wraps them).
import type { Release } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'changelog'>; first?: boolean; anchor?: string; items: Release[] }>()
const words = useSiteWords()
const size = computed(() => byLength(props.block.heading, [[26, 'text-[44px] sm:text-[64px] lg:text-[84px]'], [44, 'text-[36px] sm:text-[48px] lg:text-[64px]']], 'text-[30px] sm:text-[40px] lg:text-[52px]'))
</script>

<template>
  <section :id="anchor" class="on-dark bg-ink text-cream">
    <div class="wrap py-14 lg:py-24">
      <div class="grid gap-5 lg:grid-cols-12 lg:items-end lg:gap-10">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="q mt-4" :class="size"><KitMarked :text="block.heading" /></component>
        </div>
        <p v-if="block.text || block.linkLabel" class="lg:col-span-5 lg:pb-3">{{ tidyText(block.text) }} <SiteLink v-if="block.linkLabel && block.linkUrl" class="ul font-medium" :to="block.linkUrl">{{ tidyText(block.linkLabel) }}</SiteLink></p>
      </div>
    </div>
    <div class="mx-auto max-w-[1360px] pb-14 lg:hidden">
      <UCarousel
        v-slot="{ item, index }" :items="items" align="start" contain-scroll="trimSnaps" drag-free
        :ui="{ viewport: 'px-4 md:px-10', container: 'items-stretch -ms-3', item: 'basis-[78%] sm:basis-[44%] ps-3' }"
      >
        <div data-release class="flex h-full flex-col rounded-[20px] p-5 text-ink" :class="index === 0 ? 'bg-brand' : 'bg-cream'">
          <p class="mono" :class="index === 0 ? 'flex items-center justify-between' : ''"><span>{{ releaseDate(item.date) }}</span><span v-if="index === 0">{{ words.newest }}</span></p>
          <p class="q mt-5 text-[56px]">{{ item.version }}</p>
          <h3 class="mt-4 font-display text-[21px] font-bold leading-tight">{{ tidyText(item.title) }}</h3>
          <p v-if="item.text" class="mt-2 text-[15px] leading-[1.5]">{{ tidyText(item.text) }}</p>
        </div>
      </UCarousel>
    </div>
    <ol class="mx-auto hidden max-w-[1360px] px-10 pb-24 lg:grid lg:grid-cols-5 lg:gap-4">
      <li v-for="(item, index) in items" :key="item.id" data-release class="flex flex-col rounded-[20px] p-5 text-ink" :class="index === 0 ? 'bg-brand' : 'bg-cream'">
        <p class="mono" :class="index === 0 ? 'flex items-center justify-between' : ''"><span>{{ releaseDate(item.date) }}</span><span v-if="index === 0">{{ words.newest }}</span></p>
        <p class="q mt-5 text-[56px]">{{ item.version }}</p>
        <h3 class="mt-4 font-display text-[21px] font-bold leading-tight">{{ tidyText(item.title) }}</h3>
        <p v-if="item.text" class="mt-2 text-[15px] leading-[1.5]">{{ tidyText(item.text) }}</p>
      </li>
    </ol>
  </section>
</template>
