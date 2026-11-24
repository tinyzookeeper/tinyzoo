<script setup lang="ts">
// Sál's courses: three white cards on a tinted band, the start day large, the price, and a bar
// of the places taken.
import type { Course, LessonKind } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'courses'>; first?: boolean; anchor?: string; courses: Course[]; kinds: LessonKind[] }>()
const { words } = await useStudio()
const signup = anchorOf('signup')
const taken = (c: Course) => Math.round(((c.capacity - c.free) / Math.max(1, c.capacity)) * 100)
</script>

<template>
  <section :id="anchor" class="bg-tint">
    <div class="wrap py-16 md:py-24">
      <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div>
          <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-3 max-w-[18ch]"><KitMarked :text="block.heading" /></component>
        </div>
        <p v-if="block.text" class="max-w-[27rem] text-[1.05rem]">{{ tidyText(block.text) }}</p>
      </div>
      <div class="mt-10 grid md:grid-cols-3 gap-5">
        <article v-for="c in courses" :key="c.id" class="flex flex-col p-7 rounded-[1.75rem] bg-card">
          <p class="label">{{ words.startsOn(c.startsOn) }}</p>
          <p class="mt-2 font-display text-[3.5rem] leading-none text-ink">{{ words.courseDay(c.startsOn) }}</p>
          <h3 class="mt-6 text-[1.6rem] leading-tight">{{ tidyText(c.title) }}</h3>
          <p class="mt-2 text-[0.975rem]">{{ tidyText(c.text) }}</p>
          <dl class="mt-5 grid grid-cols-2 gap-4 pt-5 border-t border-line">
            <div><dt class="label">{{ words.lessonsLabel }}</dt><dd class="mt-1 text-ink text-[1.15rem] font-semibold">{{ c.lessons }}</dd></div>
            <div><dt class="label">{{ words.priceLabel }}</dt><dd class="mt-1 text-ink text-[1.15rem] font-semibold">{{ formatPrice(c.price) }} Kč</dd></div>
          </dl>
          <div class="mt-5">
            <p class="flex justify-between text-[0.9rem]"><span class="font-semibold" :class="c.free <= 3 ? 'text-warm' : 'text-brand'">{{ words.courseLeft(c.free) }}</span><span class="text-quiet">{{ words.courseOf(c.capacity) }}</span></p>
            <div class="meter mt-2"><i :style="{ width: `${taken(c)}%` }" /></div>
          </div>
          <NuxtLink class="btn btn-line mt-7" :to="`/#${signup}`" data-course-enrol>{{ words.enrol }}</NuxtLink>
        </article>
      </div>
    </div>
  </section>
</template>
