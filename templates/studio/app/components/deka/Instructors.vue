<script setup lang="ts">
// Deka's instructors: portraits on an offset block in the colour of what the person teaches, and
// their kinds as pills. On a phone a row to swipe, on a tablet two columns, on a desktop four.
import type { Instructor, LessonKind } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'instructors'>; first?: boolean; anchor?: string; instructors: Instructor[]; kinds: LessonKind[] }>()
// The thread of one of an instructor's kinds, by where the kind stands in the list of kinds.
const threadOfKind = (k: { id: string } | undefined) => `th${threadOf(Math.max(0, props.kinds.findIndex((x) => x.id === k?.id)))}`
// A tag takes the colour of the kind of its place; the tags after the last kind take the last one's.
const tagThread = (i: Instructor, n: number) => threadOfKind(i.teaches[Math.min(n, i.teaches.length - 1)])
const pills = ['bg-k1', 'bg-k2', 'bg-k3', 'bg-k4', 'bg-k5']
const pill = (i: Instructor, n: number) => pills[Number(tagThread(i, n).slice(2)) - 1]
</script>

<template>
  <section :id="anchor" class="wrap py-16 md:py-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end">
      <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-7"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="lg:col-span-5">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 -mx-5 md:mx-0">
      <UCarousel
        v-slot="{ item }" :items="instructors" align="start" contain-scroll="trimSnaps" :breakpoints="{ '(min-width: 768px)': { active: false } }"
        :ui="{ viewport: 'px-5 pb-3 md:px-0', container: 'items-start -ms-4 md:-ms-8 md:flex-wrap md:-mb-10', item: 'basis-[79%] ps-4 md:basis-1/2 lg:basis-1/4 md:ps-8 md:mb-10' }"
      >
        <article :class="tagThread(item, 0)">
          <div class="ph aspect-[4/5] mr-2.5 shadow-[10px_10px_0_var(--k)]"><CmsImage v-if="item.photo" :media="item.photo" sizes="(min-width: 1024px) 18rem, (min-width: 768px) 40vw, 78vw" /></div>
          <h3 class="mt-7 text-[1.5rem] leading-tight">{{ item.name }}</h3>
          <p class="mt-2 flex flex-wrap gap-1.5 text-[0.85rem] font-semibold text-ink"><span v-for="(tag, n) in tagsOf(item.label)" :key="n" class="px-2.5 py-0.5 rounded-full" :class="pill(item, n)">{{ tag }}</span></p>
          <p class="mt-3 text-[0.975rem]">{{ tidyText(item.bio) }}</p>
        </article>
      </UCarousel>
    </div>
  </section>
</template>
