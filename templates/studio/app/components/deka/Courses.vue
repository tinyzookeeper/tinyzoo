<script setup lang="ts">
// Deka's courses: white stitched tickets on a band in the colour of the site, the start day
// large, a round dot and a pill in the colour of the kind, and the places left.
import type { Course, LessonKind } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'courses'>; first?: boolean; anchor?: string; courses: Course[]; kinds: LessonKind[] }>()
const { words } = await useStudio()
const signup = anchorOf('signup')
const thread = (c: Course) => `th${threadOf(Math.max(0, props.kinds.findIndex((k) => k.id === c.kind?.id)))}`
</script>

<template>
  <section :id="anchor" class="bg-brand text-brand-ink">
    <div class="wrap py-16 md:py-24">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-3 !text-brand-ink"><KitMarked :text="block.heading" /></component>
        </div>
        <p v-if="block.text" class="lg:col-span-5">{{ tidyText(block.text) }}</p>
      </div>
      <div class="mt-10 grid md:grid-cols-3 gap-4 lg:gap-6">
        <article v-for="c in courses" :key="c.id" class="flex flex-col p-2 rounded-md bg-paper text-body" :class="thread(c)">
          <div class="stitch flex flex-col flex-1 p-5 lg:p-6 rounded-[4px]">
            <div class="flex items-end justify-between gap-4">
              <p><span class="block text-[0.875rem] font-semibold text-ink">{{ words.startsOn(c.startsOn) }}</span><span class="block mt-1 font-display font-bold text-[3.4rem] leading-none text-ink">{{ words.courseDay(c.startsOn) }}</span></p>
              <span class="sw !w-9 !h-9 !rounded-full mb-1" aria-hidden="true" />
            </div>
            <h3 class="mt-5 text-[1.5rem] leading-tight">{{ tidyText(c.title) }}</h3>
            <p class="mt-2 text-[0.975rem]">{{ tidyText(c.text) }}</p>
            <p class="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-semibold text-ink"><span>{{ words.lessonsCount(c.lessons) }}</span><span>{{ formatPrice(c.price) }} Kč</span></p>
            <p class="mt-3 self-start px-3 py-1 rounded-full bg-[var(--k)] text-ink text-[0.875rem] font-semibold">{{ words.courseLeft(c.free) }} {{ words.courseOf(c.capacity) }}</p>
            <div class="mt-auto pt-6"><NuxtLink class="btn w-full" :to="`/#${signup}`" data-course-enrol>{{ words.enrol }}</NuxtLink></div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
