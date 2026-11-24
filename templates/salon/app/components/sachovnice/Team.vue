<script setup lang="ts">
// Šachovnice's team: on black, under a strip of the floor, a square portrait for each person
// and the six days they work as tiles (a filled tile is a day they stand at the chair).
import type { Person } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; people: Person[] }>()
const words = useSiteWords()
const choice = useBookingChoice()
const worksOn = (p: Person) => workDays(p).flatMap((on, i) => (on ? [words.value.weekdays[i]!.toLowerCase()] : []))
</script>

<template>
  <section :id="anchor" class="on-ink bg-ink text-paper scroll-mt-2">
    <div class="checker h-6" style="--sq:12px" aria-hidden="true" />
    <div class="wrap py-16 md:py-24">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
        <component :is="first ? 'h1' : 'h2'" class="lg:col-span-7" :class="wideHeading(block.heading)">{{ tidyText(block.heading) }}</component>
        <p v-if="block.text" class="lg:col-span-5 max-w-[30rem] text-[18px]">{{ tidyText(block.text) }}</p>
      </div>
      <ul class="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
        <li v-for="p in people" :key="p.id" class="grid grid-cols-[112px_1fr] sm:block gap-5">
          <div class="aspect-square bg-paper overflow-hidden"><CmsImage v-if="p.photo" :media="p.photo" sizes="(min-width: 1024px) 340px, (min-width: 640px) 45vw, 120px" class="w-full h-full object-cover" /></div>
          <div class="sm:mt-5">
            <p v-if="p.role" class="tag text-brand">{{ p.role }}</p>
            <h3 class="mt-2 text-[20px] leading-[1.15] font-bold">{{ p.name }}</h3>
            <p v-if="p.bio" class="mt-2 text-[16px] opacity-90">{{ tidyText(p.bio) }}</p>
            <ul class="mt-4 flex" :aria-label="words.worksLabel(worksOn(p))">
              <li
                v-for="(on, i) in workDays(p)" :key="i" class="w-8 h-8 max-[359px]:w-6 max-[359px]:h-6 -ml-0.5 first:ml-0 border-2 border-paper flex items-center justify-center font-display text-[10px] font-bold lowercase"
                :class="on ? 'bg-paper text-ink' : 'text-paper/70'" :aria-hidden="on ? undefined : 'true'"
              >{{ words.weekdaysShort[i] }}</li>
            </ul>
            <NuxtLink :to="`/#${anchorOf('booking')}`" :data-person-book="p.name" class="mt-3 inline-flex items-center gap-2 min-h-11 font-extrabold border-b-2 border-transparent hover:border-brand" @click="choice.person.value = p.name">{{ p.bookLabel || block.bookLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
