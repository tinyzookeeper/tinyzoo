<script setup lang="ts">
// Hřiště's news: the newest article large beside a soft-cornered photograph, the others as cards
// with a photograph, a pill for the section and the first words: a row to swipe on a phone, a
// grid of three from the width of a tablet.
import type { Article } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'news'>; first?: boolean; anchor?: string; items: Article[] }>()
const words = useSiteWords()
const lead = computed(() => props.items[0] ?? null)
const rest = computed(() => props.items.slice(1))
const day = (a: Article) => (a.date ? numericDate(a.date) : '')
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-28">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-1">
      <component :is="first ? 'h1' : 'h2'" class="disp h2"><span class="slash" aria-hidden="true" /><KitMarked :text="block.heading" plain /></component>
      <NuxtLink v-if="block.linkLabel" class="more" :to="siteHref(block.linkUrl)">{{ block.linkLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
    </div>
    <p v-if="!lead" class="mt-8 text-quiet">{{ words.noArticles }}</p>
    <article v-else class="zoom mt-6 grid items-center gap-x-12 gap-y-5 lg:mt-8 lg:grid-cols-12">
      <NuxtLink v-if="lead.image" :to="articleHref(lead)" class="photo block lg:col-span-7" tabindex="-1" aria-hidden="true"><CmsImage :media="lead.image" alt="" sizes="(min-width: 1024px) 45rem, 100vw" class="aspect-[3/2] w-full object-cover lg:aspect-[16/10]" /></NuxtLink>
      <div :class="lead.image ? 'lg:col-span-5' : 'lg:col-span-12'">
        <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14.5px] text-quiet"><span class="rounded-full bg-brand-soft px-3 py-1 font-display font-extrabold text-brand">{{ words.categoryLong[lead.category] }}</span>{{ day(lead) }}</p>
        <h3 class="disp mt-4 text-[clamp(27px,3vw,40px)]"><NuxtLink class="transition-colors hover:text-brand" :to="articleHref(lead)">{{ tidyText(lead.title) }}</NuxtLink></h3>
        <p v-if="lead.summary" class="mt-4 max-w-[34rem] text-quiet">{{ tidyText(lead.summary) }}</p>
        <NuxtLink class="more mt-3" :to="articleHref(lead)">{{ lead.category === 'report' ? words.readReport : words.readArticle }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
      </div>
    </article>
    <div v-if="rest.length" class="mt-10 lg:mt-14">
      <SwipeRow :items="rest" phone="md:hidden" grid="hidden md:grid md:grid-cols-3 md:gap-6 md:pb-2" bleed="-mx-4 sm:mx-0" viewport="px-4 pb-2 sm:px-0" container="-ms-4" item="basis-[78.9%] sm:basis-[47.3%] ps-4">
        <template #default="{ item: a }">
          <article class="zoom">
            <NuxtLink v-if="a.image" :to="articleHref(a)" class="photo block !rounded-3xl" tabindex="-1" aria-hidden="true"><CmsImage :media="a.image" alt="" sizes="(min-width: 768px) 24rem, 80vw" class="aspect-[3/2] w-full object-cover" /></NuxtLink>
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14.5px] text-quiet" :class="a.image ? 'mt-4' : ''"><span class="rounded-full bg-brand-soft px-3 py-1 font-display font-extrabold text-brand">{{ words.categoryLong[a.category] }}</span>{{ day(a) }}</p>
            <h3 class="disp mt-3 text-[22px] lg:text-[24px]"><NuxtLink class="transition-colors hover:text-brand" :to="articleHref(a)">{{ tidyText(a.title) }}</NuxtLink></h3>
            <p v-if="a.summary" class="mt-2 text-[16px] text-quiet">{{ tidyText(a.summary) }}</p>
          </article>
        </template>
      </SwipeRow>
    </div>
  </section>
</template>
