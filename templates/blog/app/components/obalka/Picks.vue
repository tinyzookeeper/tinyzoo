<script setup lang="ts">
// Obálka's three larger articles: one large with its photograph, one beside it, a smaller one
// with a thumbnail, in an uneven split.
import type { Article } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'picks'>; first?: boolean; anchor?: string; articles: Article[] }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const picks = computed(() => picksOf(props.articles))
const stats = computed(() => statsOf(props.articles))
const line = computed(() => words.value.stats(stats.value.count, hoursMinutes(stats.value.minutes)))
</script>

<template>
  <section class="wrap pb-20 pt-6 lg:pb-28 lg:pt-24" :aria-labelledby="anchor">
    <div class="flex items-baseline justify-between gap-6 border-t border-ink pt-4 lg:border-0 lg:pt-0">
      <component :is="tag" :id="anchor" class="kicker"><KitMarked :text="block.heading" plain /></component>
      <NuxtLink v-if="block.linkUrl" :to="siteHref(block.linkUrl)" class="byline lift inline-flex min-h-11 items-center text-quiet hover:text-ink">{{ line }}</NuxtLink>
      <span v-else class="byline text-quiet">{{ line }}</span>
    </div>

    <div v-if="picks.length" class="mt-7 grid gap-x-14 gap-y-14 lg:mt-9 lg:grid-cols-12">
      <article v-if="picks[0]" class="lg:col-span-7">
        <NuxtLink :to="articleHref(picks[0])" class="block">
          <div v-if="picks[0].image" class="zoom -mx-5 sm:mx-0"><CmsImage :media="picks[0].image" sizes="(min-width: 1024px) 52rem, 100vw" class="aspect-[3/2] w-full object-cover lg:aspect-[4/3]" /></div>
          <p class="kicker mt-6 text-brand">{{ picks[0].section.name }}</p>
          <h3 class="mt-2 font-display text-[3.1rem] font-light leading-none tracking-[-0.02em] lg:text-[4.6rem]"><span class="lift">{{ tidyText(picks[0].title) }}</span></h3>
          <p v-if="picks[0].perex" class="mt-5 max-w-[36rem] font-display text-[1.15rem] leading-[1.55] lg:text-[1.3rem]">{{ tidyText(picks[0].perex) }}</p>
          <p class="byline mt-4 text-quiet"><span class="font-bold text-ink">{{ picks[0].author.name }}</span> &nbsp;·&nbsp; {{ dayMonth(picks[0].publishedAt) }} &nbsp;·&nbsp; {{ words.minRead(minutesOf(picks[0])) }}</p>
        </NuxtLink>
      </article>

      <div v-if="picks.length > 1" class="grid content-start gap-y-12 lg:col-span-5">
        <article>
          <NuxtLink :to="articleHref(picks[1]!)" class="block">
            <div v-if="picks[1]!.image" class="zoom"><CmsImage :media="picks[1]!.image" sizes="(min-width: 1024px) 34rem, 100vw" class="aspect-[4/3] w-full object-cover" /></div>
            <p class="kicker mt-5 text-brand">{{ picks[1]!.section.name }}</p>
            <h3 class="mt-2 font-display text-[1.9rem] font-normal leading-[1.12] tracking-[-0.01em] lg:text-[2.2rem]"><span class="lift">{{ tidyText(picks[1]!.title) }}</span></h3>
            <p v-if="picks[1]!.perex" class="mt-3 font-display text-[1.08rem] leading-[1.55]">{{ tidyText(picks[1]!.perex) }}</p>
            <p class="byline mt-3 text-quiet"><span class="font-bold text-ink">{{ picks[1]!.author.name }}</span> &nbsp;·&nbsp; {{ dayMonth(picks[1]!.publishedAt) }} &nbsp;·&nbsp; {{ words.min(minutesOf(picks[1]!)) }}</p>
          </NuxtLink>
        </article>
        <article v-if="picks[2]" class="border-t border-line pt-10">
          <NuxtLink :to="articleHref(picks[2])" class="grid items-start gap-5 sm:gap-7" :class="picks[2].image ? 'grid-cols-[1fr_7.5rem] sm:grid-cols-[1fr_11rem]' : ''">
            <div>
              <p class="kicker text-brand">{{ picks[2].section.name }}</p>
              <h3 class="mt-2 font-display text-[1.55rem] font-normal leading-[1.14] tracking-[-0.01em] lg:text-[1.8rem]"><span class="lift">{{ tidyText(picks[2].title) }}</span></h3>
              <p v-if="picks[2].perex" class="mt-3 hidden font-display text-[1.02rem] leading-[1.5] sm:block">{{ tidyText(picks[2].perex) }}</p>
              <p class="byline mt-3 text-quiet"><span class="font-bold text-ink">{{ picks[2].author.name }}</span> &nbsp;·&nbsp; {{ dayShort(picks[2].publishedAt) }} &nbsp;·&nbsp; {{ words.min(minutesOf(picks[2])) }}</p>
            </div>
            <div v-if="picks[2].image" class="zoom"><CmsImage :media="picks[2].image" sizes="11rem" class="aspect-[4/5] w-full object-cover" /></div>
          </NuxtLink>
        </article>
      </div>
    </div>
  </section>
</template>
