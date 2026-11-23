<script setup lang="ts">
// Soutisk's news: three paper cards on yellow, each with its date on a dark pill.
import type { NewsItem } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'news'>; first?: boolean; anchor?: string; items: NewsItem[] }>()
const { words } = await useEvent()
</script>

<template>
  <section :id="anchor" class="relative bg-c2 pt-6 sm:pt-10 pb-24 sm:pb-36" :class="first ? 'mt-14 sm:mt-28' : ''">
    <svg class="hills text-c2" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><use href="#soutisk-hl1" fill="currentColor" /></svg>
    <div class="wrap">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        </div>
        <NuxtLink v-if="block.linkLabel && block.linkUrl" :to="siteHref(block.linkUrl)" class="ulink">{{ block.linkLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
      </div>
      <div v-if="items.length" class="mt-9 grid md:grid-cols-3 gap-4 sm:gap-5">
        <article v-for="item in items" :key="item.id" class="card p-6 sm:p-7 flex flex-col">
          <p class="self-start inline-flex items-center h-9 px-4 rounded-full bg-ink text-paper font-bold text-sm"><time :datetime="item.date.slice(0, 10)">{{ numericDate(item.date) }}</time></p>
          <h3 class="disp text-[1.5rem] leading-[1.15] mt-5"><NuxtLink :to="`/aktuality/${item.slug}`" class="hover:underline decoration-[3px] underline-offset-4 decoration-c1">{{ item.title }}</NuxtLink></h3>
          <p class="mt-3 text-quiet">{{ tidyText(item.summary) }}</p>
        </article>
      </div>
      <p v-else class="mt-9 text-lg">{{ words.noNews }}</p>
    </div>
  </section>
</template>
