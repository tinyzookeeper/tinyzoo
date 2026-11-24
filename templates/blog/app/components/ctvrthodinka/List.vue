<script setup lang="ts">
// Čtvrthodinka's staircase: the articles from the shortest to the longest, each a bar as long as
// its minutes (a rounded bar with the number in it) and a headline that grows with it.
import type { Article } from '~/lib/cms-content'

const props = defineProps<{ block: { heading: string; text?: string | null; links?: BlockOf<'list'>['links'] }; first?: boolean; anchor?: string; items: Article[] }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const shelf = useShelf()
const archive = computed(() => props.block.links?.[0] ?? null)
</script>

<template>
  <section :id="anchor" class="bg-panel" :aria-labelledby="`${anchor ?? 'list'}-h`">
    <div class="wrap py-14 lg:py-24">
      <div class="grid gap-x-12 gap-y-3 lg:grid-cols-12">
        <component :is="tag" :id="`${anchor ?? 'list'}-h`" class="text-[2.3rem] font-black leading-[0.98] tracking-[-0.04em] lg:col-span-7 lg:text-[3.6rem]"><KitMarked :text="block.heading" /></component>
        <p class="stand self-end text-[1.25rem] text-quiet lg:col-span-5 lg:text-[1.4rem]">{{ words.stairsNote }}</p>
      </div>

      <ol class="mt-8 lg:mt-12">
        <li v-for="(a, i) in items" :key="a.id" :data-min="minutesOf(a)" :style="`--m:${minutesOf(a)}`" :class="[i === items.length - 1 ? 'border-y border-rule' : 'border-t border-rule', { 'is-dim': shelf.dim(minutesOf(a)) }]">
          <NuxtLink :to="articleHref(a)" class="grid items-center gap-x-6 gap-y-2 py-4 lg:grid-cols-[22rem_1fr_5.5rem] lg:py-3.5" :class="a.image ? 'grid-cols-[1fr_4.5rem]' : ''">
            <span class="step flex h-8 items-center justify-end rounded-full bg-brand pr-3 text-[0.95rem] font-extrabold text-brand-ink lg:h-10" :class="a.image ? 'col-span-2 lg:col-span-1' : ''">{{ minutesOf(a) }}<span class="sr-only"> {{ words.minutesRead(minutesOf(a)) }}</span></span>
            <span><span class="step-title block font-extrabold leading-[1.12] tracking-[-0.02em]"><span class="lift">{{ tidyText(listTitle(a, words)) }}</span></span><span class="meta mt-1 block">{{ a.kind === 'column' ? words.column : a.section.name }} &nbsp;·&nbsp; {{ a.author.name }} &nbsp;·&nbsp; {{ dayShort(a.publishedAt) }}</span></span>
            <span v-if="a.image" class="shot rounded-xl"><CmsImage :media="a.image" sizes="6rem" class="aspect-square w-full object-cover" /></span>
          </NuxtLink>
        </li>
      </ol>
      <p v-if="archive" class="meta mt-6"><NuxtLink :to="siteHref(archive.url)" class="inline-flex h-11 items-center gap-2 font-bold text-ink"><span class="lift">{{ archive.label }}</span> <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink></p>
    </div>
  </section>
</template>
