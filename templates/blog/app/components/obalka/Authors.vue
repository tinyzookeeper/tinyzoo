<script setup lang="ts">
// Obálka's authors: a tinted band, a heading and three portraits (4:5) with their name, role, number
// of articles and a few words. On a phone the portrait stands beside the text.
import type { Article, Author } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'authors'>; first?: boolean; anchor?: string; articles: Article[]; authors: Author[] }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
</script>

<template>
  <section :id="anchor" class="bg-tint" :aria-labelledby="`${anchor ?? 'authors'}-h`">
    <div class="wrap py-16 lg:py-24">
      <div class="grid gap-x-12 gap-y-10 lg:grid-cols-4">
        <div>
          <component :is="tag" :id="`${anchor ?? 'authors'}-h`" class="font-display text-[3rem] font-extralight leading-none tracking-[-0.025em] lg:text-[4.2rem]"><KitMarked :text="block.heading" /></component>
          <p v-if="block.text" class="mt-5 max-w-[34rem] font-display text-[1.12rem] leading-[1.55]">{{ tidyText(block.text) }}</p>
        </div>
        <ul class="grid gap-x-12 gap-y-10 sm:grid-cols-3 lg:col-span-3">
          <li v-for="a in authors" :key="a.id">
            <NuxtLink :to="`/autor/${a.slug}`" class="grid grid-cols-[7rem_1fr] items-start gap-5 sm:block">
              <div v-if="a.photo" class="zoom"><CmsImage :media="a.photo" sizes="(min-width: 640px) 22rem, 7rem" class="aspect-[4/5] w-full object-cover" /></div>
              <div>
                <h3 class="font-display text-[1.7rem] font-light leading-tight sm:mt-5 lg:text-[2rem]"><span class="lift">{{ a.name }}</span></h3>
                <p class="kicker mt-1.5 text-brand">{{ [a.role, words.articlesOf(byAuthor(articles, a).length)].filter(Boolean).join(' · ') }}</p>
                <p v-if="a.bio" class="mt-3 font-display text-[1.05rem] leading-[1.5]">{{ tidyText(a.bio) }}</p>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
