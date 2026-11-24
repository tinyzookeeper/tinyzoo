<script setup lang="ts">
// Lhůty's articles: a row of three (more wrap into rows) divided by rules, each a date in mono,
// a title in Plex Serif and two sentences.
import type { Article } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'articles'>; first?: boolean; anchor?: string; items: Article[] }>()
// A cell's rules and padding by its column; the rows after the first are divided by a rule above.
const cell = (i: number) => [
  'md:border-r md:pr-8',
  'md:border-r md:px-8',
  'md:pl-8',
][i % 3] + (i >= 3 ? ' md:border-t md:border-line' : '')
const row = (i: number, n: number) => (i === n - 1 ? '' : 'border-b border-line md:border-b-0')
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-24">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p v-if="block.eyebrow" class="label text-quiet"><span class="ticks" />{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] leading-[1.15] sm:text-[42px]" :class="block.eyebrow ? 'mt-5' : ''"><KitMarked :text="block.heading" /></component>
      </div>
      <SiteLink v-if="block.allLabel && block.allUrl" :to="block.allUrl" class="ulink text-[16px]">{{ block.allLabel }}</SiteLink>
    </div>
    <div v-if="items.length" class="mt-10 grid border-t border-ink md:grid-cols-3">
      <article v-for="(a, i) in items" :key="a.id" class="py-7" :class="[cell(i), row(i, items.length)]" data-article>
        <p v-if="a.date" class="num text-[13px] text-signal-text"><time :datetime="dateParts(a.date)?.iso">{{ numericDate(a.date) }}</time></p>
        <h3 class="mt-3 font-display text-[23px] leading-[1.25]"><NuxtLink :to="`/clanek/${a.slug}`" class="hover:underline hover:decoration-1 hover:underline-offset-4">{{ tidyText(a.title) }}</NuxtLink></h3>
        <p v-if="a.summary" class="mt-3 text-[15.5px] leading-[1.6] text-ink/85">{{ tidyText(a.summary) }}</p>
      </article>
    </div>
  </section>
</template>
