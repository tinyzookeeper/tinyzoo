<script setup lang="ts">
// Tabule's instructors: dark, four portraits printed in the colour of the site (their own colours
// under the pointer), the name in capitals. On a phone a row to swipe.
import type { Instructor, LessonKind } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'instructors'>; first?: boolean; anchor?: string; instructors: Instructor[]; kinds: LessonKind[] }>()
</script>

<template>
  <section :id="anchor" class="on-dark bg-ink text-paper">
    <div class="wrap py-16 lg:py-24">
      <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mono lg:pb-3">{{ block.text }}</p>
      </div>
      <div class="mt-10 -mx-5 md:mx-0">
        <UCarousel
          v-slot="{ item }" :items="instructors" align="start" contain-scroll="trimSnaps" :breakpoints="{ '(min-width: 768px)': { active: false } }"
          :ui="{ viewport: 'px-5 md:px-0', container: 'items-start -ms-0.5 md:flex-wrap', item: 'basis-[74.2%] ps-0.5 md:basis-1/4' }"
        >
          <article>
            <div class="duo aspect-[4/5]"><CmsImage v-if="item.photo" :media="item.photo" sizes="(min-width: 768px) 20rem, 74vw" /></div>
            <h3 class="mt-4 font-display font-bold uppercase text-[1.45rem] leading-[1.05] tracking-[-0.02em]">{{ item.name }}</h3>
            <p class="mono mt-1.5 text-accent">{{ item.label }}</p>
            <p class="mt-3 pr-6 opacity-85">{{ tidyText(item.bio) }}</p>
          </article>
        </UCarousel>
      </div>
    </div>
  </section>
</template>
