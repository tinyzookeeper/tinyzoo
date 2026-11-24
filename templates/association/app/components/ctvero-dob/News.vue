<script setup lang="ts">
// Čtvero dob's news: cards on the second ground, a row to swipe on a phone and four columns on
// a desktop; the page of all news lets them wrap into rows instead.
import type { News } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'news'>; first?: boolean; anchor?: string; news: News[] }>()
const shown = computed(() => props.news.slice(0, props.block.count ?? 4))
</script>

<template>
  <section :id="anchor" class="scroll-mt-6 bg-sand" :class="first ? 'pb-20 pt-[calc(80px+5rem)] md:pb-24 md:pt-[calc(80px+6rem)]' : 'py-20 md:py-24'">
    <div class="wrap">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" /></component>
        <NuxtLink v-if="!block.list && block.allLabel && block.allUrl" class="u tap mb-1" :to="siteHref(block.allUrl)">{{ block.allLabel }}</NuxtLink>
      </div>
    </div>
    <div v-if="block.list" class="wrap mt-10">
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"><CtveroDobNewsCard v-for="n in shown" :key="n.id" :item="n" /></div>
    </div>
    <div v-else class="wrap mt-10 max-lg:!px-0">
      <UCarousel
        v-slot="{ item }" :items="shown" align="start" drag-free
        :breakpoints="{ '(min-width: 1024px)': { active: false } }"
        :ui="{ viewport: 'px-5 pb-6 md:px-10 lg:px-0 lg:pb-0', container: '-ms-5 items-stretch lg:-ms-6', item: 'basis-[calc(80%+4px)] ps-5 sm:basis-[calc(46%+10.8px)] lg:basis-1/4 lg:ps-6' }"
      >
        <CtveroDobNewsCard :item="item" />
      </UCarousel>
    </div>
  </section>
</template>
