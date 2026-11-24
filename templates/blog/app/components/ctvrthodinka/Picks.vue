<script setup lang="ts">
// Čtvrthodinka's three larger articles: one wide and two narrow cards, each with the clock of its
// reading time, the longest first.
import type { Article } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'picks'>; first?: boolean; anchor?: string; articles: Article[] }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const shelf = useShelf()
// The design glues only "a" to the word after it in these narrow headlines: its lines break where the editor's own words do.
const narrow = (title: string) => title.replace(/ a /g, ' a\u00A0')
const picks = computed(() => [...picksOf(props.articles)].sort((a, b) => minutesOf(b) - minutesOf(a)))
</script>

<template>
  <section class="wrap pb-16 lg:pb-24" :aria-labelledby="anchor">
    <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-t-2 border-ink pt-5">
      <component :is="tag" :id="anchor" class="flex items-center gap-4 text-[2rem] font-black leading-none tracking-[-0.04em] lg:text-[3rem]"><span class="dial [--size:2.2rem] lg:[--size:2.9rem]" style="--m:15" aria-hidden="true" /><span><KitMarked :text="block.heading" /></span></component>
      <p v-if="block.note" class="meta">{{ block.note }}</p>
    </div>

    <div v-if="picks.length" class="mt-8 grid gap-x-8 gap-y-12 lg:mt-10 lg:grid-cols-12">
      <article v-for="(a, i) in picks" :key="a.id" :class="[i === 0 ? 'lg:col-span-6' : 'lg:col-span-3', { 'is-dim': shelf.dim(minutesOf(a)) }]" :data-min="minutesOf(a)">
        <NuxtLink v-if="i === 0" :to="articleHref(a)" class="block">
          <div v-if="a.image" class="shot"><CmsImage :media="a.image" sizes="(min-width: 1024px) 40rem, 100vw" class="aspect-[3/2] w-full object-cover" /></div>
          <p class="mt-5 flex items-center gap-3"><span class="dial" :style="`--m:${minutesOf(a)}`" aria-hidden="true" /><span class="text-[1rem] font-extrabold">{{ words.min(minutesOf(a)) }}</span><span class="tag">{{ a.section.name }}</span></p>
          <h3 class="head mt-3 text-[2.6rem] lg:text-[4rem]"><span class="lift">{{ tidyText(a.title) }}</span></h3>
          <p v-if="a.perex" class="stand mt-3 max-w-[36rem] text-[1.25rem] lg:text-[1.4rem]">{{ tidyText(a.perex) }}</p>
          <p class="meta mt-4"><b>{{ a.author.name }}</b> &nbsp;·&nbsp; {{ dayMonth(a.publishedAt) }}</p>
        </NuxtLink>
        <NuxtLink v-else :to="articleHref(a)" class="lg:block" :class="a.image ? 'grid grid-cols-[7.5rem_1fr] gap-x-5' : 'block'">
          <div v-if="a.image" class="shot self-start"><CmsImage :media="a.image" sizes="(min-width: 1024px) 20rem, 8rem" class="aspect-[4/5] w-full object-cover" /></div>
          <div>
            <p class="flex flex-wrap items-center gap-x-3 gap-y-2 lg:mt-5"><span class="dial" :style="`--m:${minutesOf(a)}`" aria-hidden="true" /><span class="text-[1rem] font-extrabold">{{ words.min(minutesOf(a)) }}</span><span class="tag">{{ a.section.name }}</span></p>
            <h3 class="head mt-3 text-[1.45rem] lg:text-[1.8rem]"><span class="lift">{{ narrow(a.title) }}</span></h3>
            <p v-if="a.perex" class="stand mt-3 hidden text-[1.2rem] lg:block">{{ tidyText(a.perex) }}</p>
            <p class="meta mt-3"><b>{{ a.author.name }}</b> &nbsp;·&nbsp; {{ dayShort(a.publishedAt) }}</p>
          </div>
        </NuxtLink>
      </article>
    </div>
  </section>
</template>
