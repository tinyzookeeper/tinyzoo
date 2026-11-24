<script setup lang="ts">
// Sál's instructors: four portraits in soft frames with a line about each. On a phone a row to
// swipe; from a tablet's width all of them are side by side.
import type { Instructor, LessonKind } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'instructors'>; first?: boolean; anchor?: string; instructors: Instructor[]; kinds: LessonKind[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pb-20 md:pb-28">
    <div class="pt-10 border-t border-line">
      <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="mt-4 max-w-[34rem]">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 -mx-5 md:mx-0">
      <UCarousel
        v-slot="{ item }" :items="instructors" align="start" contain-scroll="trimSnaps" :breakpoints="{ '(min-width: 768px)': { active: false } }"
        :ui="{ viewport: 'px-5 md:px-0', container: 'items-start -ms-4 md:-ms-6 md:flex-wrap', item: 'basis-[73.2%] ps-4 md:basis-1/4 md:ps-6' }"
      >
        <article>
          <div class="ph aspect-[4/5]"><CmsImage v-if="item.photo" :media="item.photo" sizes="(min-width: 768px) 20rem, 72vw" /></div>
          <h3 class="mt-5 text-[1.6rem] leading-tight">{{ item.name }}</h3>
          <p class="label mt-1.5">{{ item.label }}</p>
          <p class="mt-3 text-[0.975rem]">{{ tidyText(item.bio) }}</p>
        </article>
      </UCarousel>
    </div>
  </section>
</template>
