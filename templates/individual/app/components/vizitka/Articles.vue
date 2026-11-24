<script setup lang="ts">
// Vizitka's articles: a text-only list, the date, the headline in the serif and the first
// lines of each, beside a short introduction.
import type { Article } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'articles'>; first?: boolean; anchor?: string; items: Article[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="border-t border-line">
    <div class="wrap py-20 lg:py-24 grid lg:grid-cols-12 gap-x-10 gap-y-8">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="label text-brand">{{ czText(block.eyebrow) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.1rem] md:text-[2.5rem] leading-[1.12]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-4 max-w-[22rem]">{{ czText(block.text) }}</p>
        <p v-if="block.linkLabel && block.linkUrl" class="mt-4"><NuxtLink class="tlink" :to="siteHref(block.linkUrl)">{{ czText(block.linkLabel) }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink></p>
      </div>
      <ul v-if="items.length" class="lg:col-span-8 border-t border-ink">
        <li v-for="(a, i) in items" :key="a.id" class="border-b" :class="i === items.length - 1 ? 'border-ink' : 'border-line'">
          <NuxtLink :to="articleHref(a.slug)" class="group grid md:grid-cols-[8.5rem_1fr_auto] gap-x-6 gap-y-2 py-6 lg:py-7 items-baseline" data-article>
            <time :datetime="dateParts(a.date)?.iso" class="label text-quiet">{{ shortDate(a.date) }}</time>
            <span>
              <span class="block serif text-ink text-[1.4rem] lg:text-[1.55rem] leading-[1.25] font-medium group-hover:text-brand transition-colors">{{ czText(a.title) }}</span>
              <span v-if="a.excerpt" class="block mt-2 max-w-[36rem]">{{ czText(a.excerpt) }}</span>
            </span>
            <UIcon name="i-lucide-arrow-right" class="hidden md:block text-ink text-[1.2rem] transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="lg:col-span-8">{{ words.noArticles }}</p>
    </div>
  </section>
</template>
