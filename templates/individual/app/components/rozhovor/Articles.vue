<script setup lang="ts">
// Rozhovor's articles: the visitor asks what to read, the owner answers, then photo cards with
// the date, the headline and the first lines.
import type { Article } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'articles'>; first?: boolean; anchor?: string; items: Article[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="wrap pb-20 lg:pb-28">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <RozhovorQuestion :question="block.question" />
      <NuxtLink v-if="block.linkLabel && block.linkUrl" class="tlink" :to="siteHref(block.linkUrl)">{{ czText(block.linkLabel) }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
    </div>
    <RozhovorAnswer :heading="block.heading" :first="first" :asked="!!block.question" class="max-w-[46rem]" />
    <div v-if="items.length" class="mt-10 grid md:grid-cols-3 gap-4 lg:gap-5">
      <NuxtLink v-for="a in items" :key="a.id" :to="articleHref(a.slug)" class="card p-3 flex flex-col" data-article>
        <div v-if="a.image" class="ph aspect-[3/2] rounded-[1.3rem]"><CmsImage :media="a.image" sizes="(min-width: 1280px) 24rem, (min-width: 768px) 30vw, 100vw" /></div>
        <div class="px-3 pt-5 pb-4">
          <time :datetime="dateParts(a.date)?.iso" class="kicker text-quiet">{{ shortDate(a.date) }}</time>
          <h3 class="mt-2 text-[1.35rem] leading-[1.2] font-bold">{{ czText(a.title) }}</h3>
          <p v-if="a.excerpt" class="mt-2 text-[1.1rem]">{{ czText(a.excerpt) }}</p>
        </div>
      </NuxtLink>
    </div>
    <p v-else class="mt-10">{{ words.noArticles }}</p>
  </section>
</template>
