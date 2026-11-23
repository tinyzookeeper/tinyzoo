<script setup lang="ts">
// Tabule's courses: a block in the accent colour, three columns ruled in black, the start day
// in huge capitals and a seat map of squares (full squares are taken).
import type { Course, LessonKind } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'courses'>; first?: boolean; anchor?: string; courses: Course[]; kinds: LessonKind[] }>()
const { words } = await useStudio()
const signup = anchorOf('signup')
// Where a course stands in its row: every column but the last is ruled on its right (a desktop), every card but the last below it (a phone).
const rule = (i: number) => (i < props.courses.length - 1 ? 'border-b-2 lg:border-b-0 lg:border-r-2' : '')
</script>

<template>
  <section :id="anchor" class="on-accent bg-accent text-accent-ink">
    <div class="wrap py-16 lg:py-24">
      <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <p class="max-w-[28rem] lg:pb-3"><span v-if="block.eyebrow" class="mono block mb-1">{{ block.eyebrow }}</span>{{ tidyText(block.text) }}</p>
      </div>
      <div class="mt-10 grid lg:grid-cols-3 border-2 border-accent-ink">
        <article v-for="(c, i) in courses" :key="c.id" class="flex flex-col p-6 lg:p-8 border-accent-ink" :class="rule(i)">
          <p class="mono">{{ words.startsOn(c.startsOn) }}</p>
          <p class="display mt-2 text-[3.4rem] lg:text-[4.4rem] leading-none whitespace-nowrap">{{ words.courseDay(c.startsOn) }}</p>
          <h3 class="mt-6 font-display font-bold text-[1.6rem] leading-[1.1] tracking-[-0.02em]">{{ tidyText(c.title) }}</h3>
          <p class="mt-2">{{ tidyText(c.text) }}</p>
          <p class="mono mt-5 pt-4 border-t-2 border-accent-ink flex justify-between"><span>{{ words.lessonsCount(c.lessons) }}</span><span>{{ formatPrice(c.price) }} Kč</span></p>
          <div class="mt-5 lg:mt-auto lg:pt-5">
            <div class="seats" aria-hidden="true"><i v-for="n in Math.max(0, c.capacity - c.free)" :key="`t${n}`" /><i v-for="n in c.free" :key="`f${n}`" class="free" /></div>
            <p class="mono mt-2"><b class="font-medium">{{ words.courseLeft(c.free) }}</b> {{ words.courseOf(c.capacity) }}</p>
          </div>
          <NuxtLink class="btn btn-ink mt-7" :to="`/#${signup}`" data-course-enrol>{{ words.enrol }} <UIcon name="i-lucide-arrow-right" class="ico size-[1em]" aria-hidden="true" /></NuxtLink>
        </article>
      </div>
    </div>
  </section>
</template>
