<script setup lang="ts">
// Časomíra's news: dated lines of an organiser's bulletin, the date lit in the colour of the diodes.
import type { NewsItem } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'news'>; first?: boolean; anchor?: string; items: NewsItem[] }>()
const { words } = await useEvent()
</script>

<template>
  <section :id="anchor" class="border-t border-line py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
        </div>
        <NuxtLink v-if="block.linkLabel && block.linkUrl" :to="siteHref(block.linkUrl)" class="ulink mono">{{ block.linkLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
      </div>
      <div class="mt-9 border-t border-line">
        <article v-for="item in items" :key="item.id" class="group grid md:grid-cols-[9rem_minmax(0,5fr)_minmax(0,6fr)_2rem] gap-x-8 gap-y-1 py-6 border-b border-line items-baseline">
          <p class="font-mono text-led"><time :datetime="item.date.slice(0, 10)">{{ numericDate(item.date, true) }}</time></p>
          <h3 class="text-2xl font-extrabold tracking-[-0.03em] leading-tight"><NuxtLink :to="`/aktuality/${item.slug}`" class="hover:text-led transition-colors">{{ item.title }}</NuxtLink></h3>
          <p class="text-quiet">{{ tidyText(item.summary) }}</p>
          <UIcon name="i-lucide-arrow-right" class="hidden md:block text-xl text-quiet" aria-hidden="true" />
        </article>
        <p v-if="!items.length" class="py-6 text-quiet border-b border-line">{{ words.noNews }}</p>
      </div>
    </div>
  </section>
</template>
