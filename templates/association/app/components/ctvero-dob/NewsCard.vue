<script setup lang="ts">
// One piece of news as a card: with a photograph, or led by the day of the month in large
// figures. The dot is the mark of the season it was written in.
import type { News } from '../../lib/cms-content'

const props = defineProps<{ item: News }>()
const { words } = await useAssociation()
const parts = computed(() => dayParts(props.item.date))
const href = computed(() => `/aktuality/${props.item.slug}`)
</script>

<template>
  <article v-if="parts" class="card flex h-full flex-col" :class="item.photo ? 'overflow-hidden' : 'p-6'" data-news>
    <CmsImage v-if="item.photo" :media="item.photo" sizes="(min-width: 1024px) 20rem, 80vw" class="aspect-[16/9] w-full object-cover" />
    <div class="flex grow flex-col" :class="item.photo ? 'p-6' : ''">
      <p v-if="!item.photo" class="serif lnum text-[3.4rem] font-extrabold leading-[0.85] text-ink">{{ parts.day }}.</p>
      <p class="flex items-center gap-2 text-[0.95rem] font-semibold text-ink" :class="item.photo ? '' : 'mt-2'"><span class="h-2.5 w-2.5 rounded-full" :class="MARK[seasonOfMonth(parts.month)]" />{{ item.photo ? `${parts.day}. ` : '' }}{{ words.monthsOf[parts.month - 1] }} {{ parts.year }}</p>
      <h3 class="text-[1.5rem] leading-[1.15]" :class="item.photo ? 'mt-2' : 'mt-6'"><NuxtLink :to="href" class="hover:text-brand">{{ tidy(item.title) }}</NuxtLink></h3>
      <p v-if="item.summary" class="mt-2">{{ tidy(item.summary) }}</p>
      <p class="mt-auto pt-4"><NuxtLink :to="href" class="u tap gap-1.5">{{ words.readMore }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink></p>
    </div>
  </article>
</template>
