<script setup lang="ts">
// A piece of news on a page of its own (/aktuality/…): the date with the mark of its season,
// the headline, the first lines large, the photograph and the text.
import type { News } from '~/lib/cms-content'

const props = defineProps<{ entry: News }>()
const { words } = await useAssociation()
const parts = computed(() => dayParts(props.entry.date))
</script>

<template>
  <article class="pb-20 pt-[calc(80px+2rem)] md:pb-28 md:pt-[calc(80px+3rem)]">
    <div class="wrap">
      <p><NuxtLink class="u tap gap-2" to="/aktuality"><UIcon name="i-lucide-arrow-left" class="size-[1em]" aria-hidden="true" /> {{ words.allNewsBack }}</NuxtLink></p>
      <div class="mt-6 max-w-[46rem]">
        <p v-if="parts" class="flex items-center gap-2 text-[0.95rem] font-semibold text-ink"><span class="h-2.5 w-2.5 rounded-full" :class="MARK[seasonOfMonth(parts.month)]" />{{ parts.day }}. {{ words.monthsOf[parts.month - 1] }} {{ parts.year }}</p>
        <h1 class="h2 mt-3">{{ tidy(entry.title) }}</h1>
        <p v-if="entry.summary" class="mt-5 text-[1.2rem] leading-[1.55]">{{ tidy(entry.summary) }}</p>
      </div>
      <CmsImage v-if="entry.photo" :media="entry.photo" eager sizes="(min-width: 1024px) 60rem, 100vw" class="mt-8 aspect-[16/9] w-full max-w-[60rem] rounded-[28px] object-cover" />
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look mt-8" />
    </div>
  </article>
</template>
