<script setup lang="ts">
// Zpravodaj's news: the newest article large with a framed photograph, the next three beside it
// as small rows; on a list of all articles the rest follow below as the same rows.
import type { Article } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'news'>; first?: boolean; anchor?: string; items: Article[] }>()
const words = useSiteWords()
const lead = computed(() => props.items[0] ?? null)
const side = computed(() => props.items.slice(1, 4))
const more = computed(() => props.items.slice(4))
const stamp = (a: Article) => [words.value.category[a.category], dateParts(a.date)?.date].filter(Boolean).join(' · ')
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 pt-16 lg:pt-24">
    <div class="flex items-end justify-between gap-6 border-b border-ink pb-4">
      <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
      <NuxtLink v-if="block.linkLabel" class="link mb-1 shrink-0" :to="siteHref(block.linkUrl)">{{ block.linkLabel }}</NuxtLink>
    </div>
    <p v-if="!lead" class="mt-8">{{ words.noArticles }}</p>
    <div v-else class="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14">
      <article class="lg:col-span-7">
        <NuxtLink :to="articleHref(lead)" class="group block">
          <div v-if="lead.image" class="frame"><CmsImage :media="lead.image" sizes="(min-width: 1024px) 40rem, 100vw" class="aspect-[3/2] w-full object-cover" /></div>
          <p class="label" :class="lead.image ? 'mt-5' : ''">{{ stamp(lead) }}</p>
          <h3 class="mt-2 text-[28px] font-bold leading-[1.15] tracking-[-.01em] group-hover:text-brand lg:text-[34px]">{{ tidyText(lead.title) }}</h3>
        </NuxtLink>
        <p v-if="lead.summary" class="mt-3 max-w-[38rem]">{{ tidyText(lead.summary) }}</p>
      </article>
      <div v-if="side.length" class="lg:col-span-5">
        <article v-for="(a, i) in side" :key="a.id" class="grid grid-cols-[104px_1fr] gap-5 sm:grid-cols-[150px_1fr]" :class="i === 0 ? 'border-b border-line pb-6' : i === side.length - 1 ? 'pt-6' : 'border-b border-line py-6'">
          <CmsImage v-if="a.image" :media="a.image" sizes="150px" class="aspect-square w-full object-cover sm:aspect-[4/3]" />
          <div :class="a.image ? '' : 'col-span-2'">
            <p class="label">{{ stamp(a) }}</p>
            <h3 class="mt-1.5 text-[19px] font-bold leading-snug"><NuxtLink class="hover:text-brand" :to="articleHref(a)">{{ tidyText(a.title) }}</NuxtLink></h3>
            <p v-if="a.summary" class="mt-2 hidden text-[15px] leading-normal sm:block">{{ tidyText(a.summary) }}</p>
          </div>
        </article>
      </div>
    </div>
    <div v-if="more.length" class="mt-10 grid gap-x-14 border-t border-ink lg:grid-cols-2">
      <article v-for="a in more" :key="a.id" class="grid grid-cols-[104px_1fr] gap-5 border-b border-line py-6 sm:grid-cols-[150px_1fr]">
        <CmsImage v-if="a.image" :media="a.image" sizes="150px" class="aspect-square w-full object-cover sm:aspect-[4/3]" />
        <div :class="a.image ? '' : 'col-span-2'">
          <p class="label">{{ stamp(a) }}</p>
          <h3 class="mt-1.5 text-[19px] font-bold leading-snug"><NuxtLink class="hover:text-brand" :to="articleHref(a)">{{ tidyText(a.title) }}</NuxtLink></h3>
          <p v-if="a.summary" class="mt-2 hidden text-[15px] leading-normal sm:block">{{ tidyText(a.summary) }}</p>
        </div>
      </article>
    </div>
  </section>
</template>
