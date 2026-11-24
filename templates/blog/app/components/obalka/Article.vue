<script setup lang="ts">
// Obálka's article: the section, the headline in extra-light Spectral, the standfirst, the byline,
// the photograph wide, the text in a reading column, then the author, the series it belongs to
// and more from its section.
import type { Article } from '../../lib/cms-content'

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
    <header class="wrap pb-10 pt-12 lg:pb-14 lg:pt-20">
      <div class="mx-auto max-w-[52rem]">
        <p class="kicker flex flex-wrap gap-x-3 text-brand">
          <NuxtLink :to="`/rubrika/${entry.section.slug}`" class="lift">{{ entry.section.name }}</NuxtLink>
          <span v-if="entry.kind === 'column'">· {{ words.column }}</span>
          <NuxtLink v-if="entry.series" :to="`/serial/${entry.series.slug}`" class="lift">· {{ entry.series.name }}<template v-if="entry.seriesPart">, {{ words.part(entry.seriesPart) }}</template></NuxtLink>
        </p>
        <h1 class="mt-4 font-display text-[2.6rem] font-light leading-[1.05] tracking-[-0.02em] sm:text-5xl lg:text-[4.4rem]">{{ tidyText(entry.title) }}</h1>
        <p v-if="entry.perex" class="mt-6 font-display text-[1.25rem] leading-[1.5] lg:text-[1.55rem]">{{ tidyText(entry.perex) }}</p>
        <p class="byline mt-6 text-quiet"><NuxtLink :to="`/autor/${entry.author.slug}`" class="lift font-bold text-ink">{{ entry.author.name }}</NuxtLink> &nbsp;·&nbsp; <time :datetime="entry.publishedAt ?? undefined">{{ formatDate(entry.publishedAt) }}</time> &nbsp;·&nbsp; {{ words.minRead(minutesOf(entry)) }}</p>
      </div>
    </header>

    <figure v-if="entry.image" class="wrap">
      <div class="mx-auto max-w-[72rem]">
        <CmsImage :media="entry.image" eager sizes="(min-width: 1024px) 72rem, 100vw" class="-mx-5 aspect-[3/2] w-[calc(100%+2.5rem)] max-w-none object-cover sm:mx-0 sm:w-full lg:aspect-[16/9]" />
        <figcaption v-if="entry.imageCaption || entry.imageCredit" class="byline mt-3 text-quiet">{{ entry.imageCaption }}<template v-if="entry.imageCaption && entry.imageCredit"> &nbsp;·&nbsp; </template><template v-if="entry.imageCredit">{{ words.photoBy(entry.imageCredit) }}</template></figcaption>
      </div>
    </figure>

    <div class="wrap py-12 lg:py-16">
      <div class="mx-auto max-w-[40rem]">
        <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />

        <nav v-if="entry.series && parts.length > 1" :aria-label="entry.series.name" class="mt-14 bg-deep px-6 py-7 text-deep-ink">
          <p class="kicker text-deep-soft">{{ words.series }} &nbsp;·&nbsp; {{ words.partOfTotal(entry.seriesPart ?? at + 1, entry.series.plannedParts ?? parts.length) }}</p>
          <p class="mt-2 font-display text-[1.8rem] font-extralight leading-none tracking-[-0.02em]"><NuxtLink :to="`/serial/${entry.series.slug}`" class="lift">{{ entry.series.name }}</NuxtLink></p>
          <p class="byline mt-5 flex flex-wrap justify-between gap-x-6">
            <NuxtLink v-if="parts[at - 1]" :to="articleHref(parts[at - 1]!)" class="lift inline-flex min-h-11 items-center gap-2"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> {{ words.previousPart }}</NuxtLink><span v-else />
            <NuxtLink v-if="parts[at + 1]" :to="articleHref(parts[at + 1]!)" class="lift inline-flex min-h-11 items-center gap-2">{{ words.nextPart }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
          </p>
        </nav>

        <aside v-if="author" class="mt-14 border-t border-ink pt-8">
          <NuxtLink :to="`/autor/${author.slug}`" class="grid grid-cols-[6rem_1fr] items-start gap-5">
            <div v-if="author.photo" class="zoom"><CmsImage :media="author.photo" sizes="6rem" class="aspect-[4/5] w-full object-cover" /></div>
            <div :class="author.photo ? '' : 'col-span-2'">
              <p class="kicker text-brand">{{ words.writtenBy }}</p>
              <p class="mt-1.5 font-display text-[1.7rem] font-light leading-tight"><span class="lift">{{ author.name }}</span></p>
              <p v-if="author.role" class="byline mt-1 text-quiet">{{ author.role }}</p>
              <p v-if="author.bio" class="mt-3 font-display text-[1.05rem] leading-[1.5]">{{ tidyText(author.bio) }}</p>
            </div>
          </NuxtLink>
        </aside>
      </div>
    </div>

    <section v-if="related.length" class="bg-tint" aria-labelledby="related-h">
      <div class="wrap py-14 lg:py-20">
        <h2 id="related-h" class="kicker">{{ words.moreFrom(entry.section.name) }}</h2>
        <ul class="mt-6 grid gap-x-10 gap-y-2 sm:grid-cols-3">
          <li v-for="a in related" :key="a.id" class="border-t border-ink pt-4">
            <NuxtLink :to="articleHref(a)" class="block py-1">
              <span class="block font-display text-[1.5rem] font-light leading-[1.2]"><span class="lift">{{ tidyText(a.title) }}</span></span>
              <span class="byline mt-2 block text-quiet">{{ a.author.name }} &nbsp;·&nbsp; {{ words.min(minutesOf(a)) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>
  </article>
</template>
