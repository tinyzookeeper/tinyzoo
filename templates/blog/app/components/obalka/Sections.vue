<script setup lang="ts">
// Obálka's sections: one ruled column each, with the number of articles, a line about it and its
// latest three headlines. Five across on a desktop, two across on a tablet.
import type { Article, Section } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'sections'>; first?: boolean; anchor?: string; articles: Article[]; sections: Section[] }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const columns = computed(() => props.sections.map((s) => ({ section: s, all: inSection(props.articles, s) })))
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-28" :aria-labelledby="`${anchor ?? 'sections'}-h`">
    <div class="grid gap-x-14 gap-y-4 lg:grid-cols-12">
      <component :is="tag" :id="`${anchor ?? 'sections'}-h`" class="font-display text-[3rem] font-extralight leading-none tracking-[-0.025em] lg:col-span-5 lg:text-[4.2rem]"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="max-w-[34rem] self-end font-display text-[1.12rem] leading-[1.55] lg:col-span-7">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:mt-14 lg:grid-cols-5">
      <div v-for="c in columns" :key="c.section.id" class="border-t border-ink pt-5">
        <h3 class="flex items-baseline justify-between"><NuxtLink :to="`/rubrika/${c.section.slug}`" class="lift inline-flex h-11 items-center font-display text-[2rem] font-light leading-none">{{ c.section.name }}</NuxtLink><span class="byline text-quiet">{{ c.all.length }}</span></h3>
        <p v-if="c.section.description" class="mt-3 font-display text-[1rem] italic leading-snug text-quiet">{{ tidyText(c.section.description) }}</p>
        <ul class="mt-3 font-display text-[1.08rem] leading-[1.3] lg:mt-5 lg:space-y-3.5 max-lg:[&_a]:block max-lg:[&_a]:py-3">
          <li v-for="a in c.all.slice(0, 3)" :key="a.id"><NuxtLink class="lift" :to="articleHref(a)">{{ tidyText(a.shortTitle || a.title) }}</NuxtLink></li>
        </ul>
        <NuxtLink :to="`/rubrika/${c.section.slug}`" class="byline lift mt-5 inline-flex h-11 items-center gap-2 text-brand">{{ words.allArticles }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </section>
</template>
