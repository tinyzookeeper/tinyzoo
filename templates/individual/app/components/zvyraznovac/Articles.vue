<script setup lang="ts">
// Zvýrazňovač's articles: big linked headlines under heavy rules, each with a small
// black-and-white thumbnail; the marker lights the headline under the pointer.
import type { Article } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'articles'>; first?: boolean; anchor?: string; items: Article[] }>()
const words = useSiteWords()
const size = computed(() => byLength(props.block.heading, [
  [40, 'text-[2.9rem] md:text-[4.5rem] lg:text-[5.6rem]'],
  [64, 'text-[2.5rem] md:text-[3.6rem] lg:text-[4.4rem]'],
], 'text-[2.2rem] md:text-[3rem] lg:text-[3.6rem]'))
</script>

<template>
  <section :id="anchor" class="wrap pb-20 lg:pb-28">
    <div class="border-t-2 border-ink pt-8 flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
      <component :is="first ? 'h1' : 'h2'" class="tracking-[-0.05em]" :class="size"><KitMarked :text="block.heading" /></component>
      <NuxtLink v-if="block.linkLabel && block.linkUrl" class="ulink lg:mb-3" :to="siteHref(block.linkUrl)">{{ czText(block.linkLabel) }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
    </div>
    <ul v-if="items.length" class="mt-10 lg:mt-12 border-b-2 border-ink">
      <li v-for="a in items" :key="a.id" class="border-t-2 border-ink">
        <NuxtLink :to="articleHref(a.slug)" class="group grid grid-cols-[1fr_5.5rem] md:grid-cols-12 gap-x-5 md:gap-x-10 gap-y-2 py-6 lg:py-7 items-center" data-article>
          <time :datetime="dateParts(a.date)?.iso" class="mono text-quiet col-span-2 md:col-span-2">{{ shortDate(a.date) }}</time>
          <span class="md:col-span-8">
            <span class="block font-extrabold text-[1.45rem] lg:text-[2rem] tracking-[-0.035em] leading-[1.1]"><span class="group-hover:bg-brand transition-colors">{{ czText(a.title) }}</span></span>
            <span v-if="a.excerpt" class="block mt-2 max-w-[40rem]">{{ czText(a.excerpt) }}</span>
          </span>
          <span v-if="a.image" class="bw aspect-square md:aspect-[4/3] md:col-span-2 self-start md:self-center"><CmsImage :media="a.image" sizes="(min-width: 768px) 16rem, 6rem" /></span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="mt-10">{{ words.noArticles }}</p>
  </section>
</template>
