<script setup lang="ts">
// Dres's news: the newest article as a photograph with a black card beside it (red when hovered),
// the others as photographs with a headline under them: a row to swipe on a phone, a grid of three
// from the width of a tablet.
import type { Article } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'news'>; first?: boolean; anchor?: string; items: Article[] }>()
const words = useSiteWords()
const lead = computed(() => props.items[0] ?? null)
const rest = computed(() => props.items.slice(1))
const stamp = (a: Article) => [words.value.category[a.category], a.date ? numericDate(a.date, 'slash') : ''].filter(Boolean).join(' · ')
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-24">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
      <component :is="first ? 'h1' : 'h2'" class="wide h2">{{ plainEmphasis(block.heading) }}</component>
      <NuxtLink v-if="block.linkLabel" class="mb-2 font-bold underline decoration-2 underline-offset-4 hover:bg-ink hover:text-paper lg:mb-4" :to="siteHref(block.linkUrl)">{{ block.linkLabel }}</NuxtLink>
    </div>
    <p v-if="!lead" class="mt-8">{{ words.noArticles }}</p>
    <article v-else class="mt-8">
      <NuxtLink :to="articleHref(lead)" class="group grid lg:grid-cols-12">
        <CmsImage v-if="lead.image" :media="lead.image" sizes="(min-width: 1024px) 55vw, 100vw" class="aspect-[3/2] h-full w-full object-cover lg:col-span-7" />
        <div class="dark flex flex-col justify-between gap-8 bg-ink p-6 text-paper transition-colors group-hover:bg-brand group-hover:text-brand-ink lg:p-10" :class="lead.image ? 'lg:col-span-5' : 'lg:col-span-12'">
          <p class="cap">{{ stamp(lead) }}</p>
          <div>
            <h3 class="head text-[28px] lg:text-[40px]">{{ tidyText(lead.title) }}</h3>
            <p v-if="lead.summary" class="mt-4 max-w-[30rem] opacity-80">{{ tidyText(lead.summary) }}</p>
          </div>
          <p class="cap flex items-center gap-2">{{ lead.category === 'report' ? words.readReport : words.readArticle }} <UIcon name="i-lucide-arrow-right" class="text-base" aria-hidden="true" /></p>
        </div>
      </NuxtLink>
    </article>
    <div v-if="rest.length" class="mt-3">
      <SwipeRow :items="rest" phone="md:hidden" grid="hidden md:grid md:grid-cols-3 md:gap-3" bleed="-mx-5" viewport="px-5" container="-ms-3" item="basis-[78.7%] ps-3">
        <template #default="{ item: a }">
          <article>
            <NuxtLink :to="articleHref(a)" class="group block">
              <CmsImage v-if="a.image" :media="a.image" sizes="(min-width: 768px) 30vw, 80vw" class="aspect-[4/3] w-full object-cover" />
              <p class="cap" :class="a.image ? 'mt-4' : ''">{{ stamp(a) }}</p>
              <h3 class="head mt-2 text-[21px] decoration-2 underline-offset-4 group-hover:underline">{{ tidyText(a.title) }}</h3>
            </NuxtLink>
          </article>
        </template>
      </SwipeRow>
    </div>
  </section>
</template>
