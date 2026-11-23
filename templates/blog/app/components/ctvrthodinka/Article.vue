<script setup lang="ts">
// Čtvrthodinka's article: the section and the clock of its reading time, a heavy headline, the
// standfirst in italics, a rounded photograph, the text, then the author, the series and more
// from its section.
import type { Article } from '~/lib/cms-content'

const props = defineProps<{ entry: Article }>()
const { words } = await useBlog()
const articles = await useArticles()
const authors = await useAuthors()
const author = computed(() => authors.value.find((a) => a.id === props.entry.author?.id) ?? null)
const parts = computed(() => (props.entry.series ? partsOf(articles.value, props.entry.series) : []))
const at = computed(() => parts.value.findIndex((p) => p.id === props.entry.id))
const related = computed(() => inSection(articles.value, props.entry.section).filter((a) => a.id !== props.entry.id).slice(0, 3))
</script>

<template>
  <article data-article>
    <header class="wrap pb-10 pt-6 lg:pb-14 lg:pt-10">
      <div class="max-w-[56rem]">
        <p class="flex flex-wrap items-center gap-3">
          <span class="dial" :style="`--m:${minutesOf(entry)}; --size:2.4rem`" aria-hidden="true" /><span class="text-[1rem] font-extrabold">{{ words.minRead(minutesOf(entry)) }}</span>
          <NuxtLink :to="`/rubrika/${entry.section.slug}`" class="tag">{{ entry.section.name }}</NuxtLink>
          <span v-if="entry.kind === 'column'" class="tag">{{ words.column }}</span>
          <NuxtLink v-if="entry.series" :to="`/serial/${entry.series.slug}`" class="tag">{{ entry.series.name }}<template v-if="entry.seriesPart">, {{ words.part(entry.seriesPart) }}</template></NuxtLink>
        </p>
        <h1 class="head mt-5 text-[2.4rem] sm:text-[3.2rem] lg:text-[4.4rem]">{{ tidyText(entry.title) }}</h1>
        <p v-if="entry.perex" class="stand mt-5 text-[1.35rem] lg:text-[1.6rem]">{{ tidyText(entry.perex) }}</p>
        <p class="meta mt-5"><NuxtLink :to="`/autor/${entry.author.slug}`" class="lift font-bold text-ink">{{ entry.author.name }}</NuxtLink> &nbsp;·&nbsp; <time :datetime="entry.publishedAt ?? undefined">{{ formatDate(entry.publishedAt) }}</time></p>
      </div>
    </header>

    <figure v-if="entry.image" class="wrap">
      <div class="shot -mx-5 rounded-none sm:mx-0 sm:rounded-[1.25rem]"><CmsImage :media="entry.image" eager sizes="(min-width: 1024px) 72rem, 100vw" class="aspect-[3/2] w-full object-cover lg:aspect-[2/1]" /></div>
      <figcaption v-if="entry.imageCaption || entry.imageCredit" class="meta mt-3">{{ entry.imageCaption }}<template v-if="entry.imageCaption && entry.imageCredit"> &nbsp;·&nbsp; </template><template v-if="entry.imageCredit">{{ words.photoBy(entry.imageCredit) }}</template></figcaption>
    </figure>

    <div class="wrap py-12 lg:py-16">
      <div class="max-w-[40rem] lg:ml-[calc((100%-40rem)/2)]">
        <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />

        <nav v-if="entry.series && parts.length > 1" :aria-label="entry.series.name" class="mt-14 rounded-[1.5rem] bg-panel p-6">
          <p class="flex items-center gap-3"><span class="dial" style="--m:45; --size:2rem" aria-hidden="true" /><span class="tag">{{ words.partOfTotal(entry.seriesPart ?? at + 1, entry.series.plannedParts ?? parts.length) }}</span></p>
          <p class="mt-3 text-[1.8rem] font-black leading-none tracking-[-0.04em]"><NuxtLink :to="`/serial/${entry.series.slug}`">{{ entry.series.name }}</NuxtLink></p>
          <p class="meta mt-4 flex flex-wrap justify-between gap-x-6">
            <NuxtLink v-if="parts[at - 1]" :to="articleHref(parts[at - 1]!)" class="inline-flex min-h-11 items-center gap-2 font-bold text-ink"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> <span class="lift">{{ words.previousPart }}</span></NuxtLink><span v-else />
            <NuxtLink v-if="parts[at + 1]" :to="articleHref(parts[at + 1]!)" class="inline-flex min-h-11 items-center gap-2 font-bold text-ink"><span class="lift">{{ words.nextPart }}</span> <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
          </p>
        </nav>

        <aside v-if="author" class="mt-14 border-t-2 border-ink pt-6">
          <NuxtLink :to="`/autor/${author.slug}`" class="grid grid-cols-[6rem_1fr] items-start gap-5">
            <CmsImage v-if="author.photo" :media="author.photo" sizes="6rem" class="aspect-square w-full rounded-full object-cover object-[50%_22%]" />
            <div :class="author.photo ? '' : 'col-span-2'">
              <p class="meta">{{ words.writtenBy }}</p>
              <p class="mt-1 text-[1.5rem] font-extrabold leading-[1.05] tracking-[-0.03em]"><span class="lift">{{ author.name }}</span></p>
              <p v-if="author.role" class="meta mt-1">{{ author.role }}</p>
              <p v-if="author.bio" class="mt-3 font-medium leading-[1.45]">{{ tidyText(author.bio) }}</p>
            </div>
          </NuxtLink>
        </aside>
      </div>
    </div>

    <section v-if="related.length" class="bg-panel" aria-labelledby="related-h">
      <div class="wrap py-14 lg:py-20">
        <h2 id="related-h" class="text-[2rem] font-black leading-none tracking-[-0.04em] lg:text-[2.6rem]">{{ words.moreFrom(entry.section.name) }}</h2>
        <ul class="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-3">
          <li v-for="a in related" :key="a.id">
            <NuxtLink :to="articleHref(a)" class="block border-t border-rule pt-4">
              <span class="flex items-center gap-3"><span class="dial" :style="`--m:${minutesOf(a)}`" aria-hidden="true" /><span class="text-[1rem] font-extrabold">{{ words.min(minutesOf(a)) }}</span></span>
              <span class="head mt-3 block text-[1.5rem]"><span class="lift">{{ tidyText(a.title) }}</span></span>
              <span class="meta mt-2 block">{{ a.author.name }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>
  </article>
</template>
