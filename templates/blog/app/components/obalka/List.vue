<script setup lang="ts">
// Obálka's contents page: the heading, a few words and links stay in view on the left while
// the articles run down the right, ruled. An article with a photograph gets a thumbnail; one
// without is set larger (a column in italics, with its standfirst), and the reading time stands
// in the right margin.
import type { Article } from '../../lib/cms-content'

const props = defineProps<{ block: { heading: string; text?: string | null; links?: BlockOf<'list'>['links'] }; first?: boolean; anchor?: string; items: Article[] }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
</script>

<template>
  <section :id="anchor" class="bg-tint" :aria-labelledby="anchor ? `${anchor}-h` : undefined">
    <div class="wrap grid gap-x-14 gap-y-8 py-16 lg:grid-cols-12 lg:py-24">
      <div class="lg:sticky lg:top-10 lg:col-span-4 lg:self-start">
        <component :is="tag" :id="anchor ? `${anchor}-h` : undefined" class="font-display text-[4.2rem] font-extralight leading-none tracking-[-0.03em] lg:text-[6.5rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-[22rem] font-display text-[1.12rem] leading-[1.55]">{{ tidyText(block.text) }}</p>
        <ul v-if="block.links?.length" class="byline mt-7 flex flex-wrap gap-x-5 gap-y-1 text-quiet">
          <li v-for="l in block.links" :key="l.id"><NuxtLink class="lift inline-flex h-11 items-center hover:text-ink" :to="siteHref(l.url)">{{ l.label }}</NuxtLink></li>
        </ul>
      </div>

      <ol class="lg:col-span-8">
        <li v-for="a in items" :key="a.id" class="border-t border-ink/20 first:border-ink">
          <NuxtLink :to="articleHref(a)" class="grid grid-cols-[5.5rem_1fr] items-start gap-x-5 py-6 sm:grid-cols-[9rem_1fr_auto] sm:gap-x-8">
            <div v-if="a.image" class="zoom"><CmsImage :media="a.image" sizes="9rem" class="aspect-[4/3] w-full object-cover" /></div>
            <div v-if="a.image">
              <p class="kicker text-brand">{{ a.kind === 'column' ? words.column : a.section.name }}</p>
              <h3 class="mt-1.5 font-display text-[1.3rem] leading-[1.22] sm:text-[1.55rem]"><span class="lift">{{ tidyText(listTitle(a, words)) }}</span></h3>
              <p class="byline mt-2 text-quiet">{{ a.author.name }} &nbsp;·&nbsp; {{ dayShort(a.publishedAt) }}<span class="sm:hidden"> &nbsp;·&nbsp; {{ words.min(minutesOf(a)) }}</span></p>
            </div>
            <p v-else class="col-span-2 sm:col-span-2">
              <span class="kicker text-brand">{{ a.kind === 'column' ? words.column : a.section.name }}</span>
              <span class="mt-1.5 block font-display leading-[1.1]" :class="a.kind === 'column' ? 'text-[2rem] font-light italic sm:text-[2.6rem]' : 'text-[1.3rem] leading-[1.22] sm:text-[1.55rem]'"><span class="lift">{{ tidyText(listTitle(a, words)) }}</span></span>
              <span v-if="a.kind === 'column' && a.perex" class="mt-2 block max-w-[38rem] font-display text-[1.05rem] leading-[1.5]">{{ tidyText(a.perex) }}</span>
              <span class="byline mt-2 block text-quiet">{{ a.author.name }} &nbsp;·&nbsp; {{ dayShort(a.publishedAt) }}<span class="sm:hidden"> &nbsp;·&nbsp; {{ words.min(minutesOf(a)) }}</span></span>
            </p>
            <p class="hidden whitespace-nowrap pt-5 font-display text-xl italic text-quiet sm:block">{{ words.min(minutesOf(a)) }}</p>
          </NuxtLink>
        </li>
      </ol>
    </div>
  </section>
</template>
