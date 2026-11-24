<script setup lang="ts">
// Čtvrthodinka's authors: round portraits with their role, a few words, and their articles and
// hours of reading.
import type { Article, Author } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'authors'>; first?: boolean; anchor?: string; articles: Article[]; authors: Author[] }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const figures = (a: Author) => { const mine = byAuthor(props.articles, a); return `${words.value.articlesOf(mine.length)}  ·  ${words.value.hoursOf(mine.reduce((s, x) => s + minutesOf(x), 0))}` }
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-28" :aria-labelledby="`${anchor ?? 'authors'}-h`">
    <div class="grid gap-x-12 gap-y-3 border-t-2 border-ink pt-5 lg:grid-cols-12">
      <component :is="tag" :id="`${anchor ?? 'authors'}-h`" class="text-[2.3rem] font-black leading-[0.98] tracking-[-0.04em] lg:col-span-7 lg:text-[3.6rem]"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="stand self-end text-[1.25rem] text-quiet lg:col-span-5 lg:text-[1.4rem]">{{ tidyText(block.text) }}</p>
    </div>
    <ul class="mt-9 grid gap-x-10 gap-y-9 lg:mt-12 lg:grid-cols-3">
      <li v-for="a in authors" :key="a.id">
        <NuxtLink :to="`/autor/${a.slug}`" class="grid grid-cols-[6rem_1fr] items-start gap-5 lg:grid-cols-[9rem_1fr] lg:gap-6">
          <CmsImage v-if="a.photo" :media="a.photo" sizes="9rem" class="aspect-square w-full rounded-full object-cover object-[50%_22%]" />
          <div :class="a.photo ? '' : 'col-span-2'">
            <h3 class="text-[1.5rem] font-extrabold leading-[1.05] tracking-[-0.03em] lg:text-[1.75rem]"><span class="lift">{{ a.name }}</span></h3>
            <p v-if="a.role" class="meta mt-1.5">{{ a.role }}</p>
            <p v-if="a.bio" class="mt-3 text-[1rem] font-medium leading-[1.45]">{{ tidyText(a.bio) }}</p>
            <p class="mt-3 text-[0.92rem] font-extrabold text-brand">{{ figures(a) }}</p>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
