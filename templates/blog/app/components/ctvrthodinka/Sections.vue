<script setup lang="ts">
// Čtvrthodinka's sections as a table: the name and the line about it on the left, the latest
// three articles with the clocks of their reading time on the right.
import type { Article, Section } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'sections'>; first?: boolean; anchor?: string; articles: Article[]; sections: Section[] }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const rows = computed(() => props.sections.map((s) => ({ section: s, all: inSection(props.articles, s) })))
</script>

<template>
  <section :id="anchor" class="bg-panel" :aria-labelledby="`${anchor ?? 'sections'}-h`">
    <div class="wrap py-14 lg:py-24">
      <div class="grid gap-x-12 gap-y-3 lg:grid-cols-12">
        <component :is="tag" :id="`${anchor ?? 'sections'}-h`" class="text-[2.3rem] font-black leading-[0.98] tracking-[-0.04em] lg:col-span-7 lg:text-[3.6rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="stand self-end text-[1.25rem] text-quiet lg:col-span-5 lg:text-[1.4rem]">{{ tidyText(block.text) }}</p>
      </div>
      <div class="mt-8 lg:mt-12">
        <div v-for="(r, i) in rows" :key="r.section.id" class="grid gap-x-10 gap-y-3 py-6 lg:grid-cols-[17rem_1fr] lg:py-7" :class="i === rows.length - 1 ? 'border-y border-rule' : 'border-t border-rule'">
          <div>
            <h3 class="flex items-baseline gap-3"><NuxtLink :to="`/rubrika/${r.section.slug}`" class="inline-flex min-h-11 items-center text-[2.2rem] font-black leading-none tracking-[-0.04em] lg:text-[2.8rem]"><span class="lift">{{ r.section.name }}</span></NuxtLink><span class="meta">{{ r.all.length }}</span></h3>
            <p v-if="r.section.description" class="stand mt-1.5 text-[1.15rem] text-quiet">{{ tidyText(r.section.description) }}</p>
          </div>
          <ul class="grid gap-x-8 gap-y-3 text-[1.05rem] font-semibold leading-[1.25] sm:grid-cols-3">
            <li v-for="a in r.all.slice(0, 3)" :key="a.id"><NuxtLink :to="articleHref(a)" class="flex min-h-11 gap-3"><span class="dial mt-0.5 [--size:1.25rem]" :style="`--m:${minutesOf(a)}`" aria-hidden="true" /><span><span class="lift">{{ tidyText(a.shortTitle || a.title) }}</span><span class="meta block">{{ words.min(minutesOf(a)) }}</span></span></NuxtLink></li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
