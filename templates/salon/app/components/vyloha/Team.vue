<script setup lang="ts">
// Výloha's team: framed portraits with the working days as six abbreviations, the days off
// faded; a row to swipe on a phone (the carousel switches itself off from `lg`, where a grid takes over).
import type { Person } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; people: Person[] }>()
const words = useSiteWords()
const choice = useBookingChoice()
const worksOn = (p: Person) => workDays(p).flatMap((on, i) => (on ? [words.value.weekdays[i]!.toLowerCase()] : []))
</script>

<template>
  <section :id="anchor" class="pt-20 md:pt-28 scroll-mt-4">
    <div class="wrap grid lg:grid-cols-12 gap-x-12 gap-y-5 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="caps text-brass">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="lettering mt-4 text-[44px] md:text-[64px] leading-[1.02]">{{ tidyText(block.heading) }}</component>
      </div>
      <p v-if="block.text" class="lg:col-span-5">{{ tidyText(block.text) }}</p>
    </div>
    <UCarousel
      v-slot="{ item }" :items="people" align="center" contain-scroll="trimSnaps" :breakpoints="{ '(min-width: 1024px)': { active: false } }"
      class="mt-12"
      :ui="{ viewport: 'wrap lg:overflow-visible', container: '-ms-5 lg:ms-0 lg:grid lg:grid-cols-4 lg:gap-8 lg:items-stretch', item: 'basis-[calc(70%+6px)] sm:basis-[calc(42%+11.6px)] ps-5 lg:ps-0 lg:basis-auto' }"
    >
      <div class="frame"><div class="aspect-[4/5] overflow-hidden"><CmsImage v-if="item.photo" :media="item.photo" sizes="(min-width: 1024px) 300px, (min-width: 640px) 42vw, 70vw" class="w-full h-full object-cover" /></div></div>
      <h3 class="mt-5 text-[27px] leading-tight">{{ item.name }}</h3>
      <p v-if="item.role" class="caps !text-[11px] text-brass mt-2">{{ item.role }}</p>
      <p v-if="item.bio" class="mt-3 text-[16px]">{{ tidyText(item.bio) }}</p>
      <ul class="mt-4 flex gap-3 caps" :aria-label="words.worksLabel(worksOn(item))">
        <li v-for="(on, i) in workDays(item)" :key="i" :class="on ? 'text-cream border-b border-brass pb-1' : 'opacity-35 pb-1'" :aria-hidden="on ? undefined : 'true'">{{ words.weekdaysShort[i] }}</li>
      </ul>
      <NuxtLink :to="`/#${anchorOf('booking')}`" :data-person-book="item.name" class="mt-2 inline-flex items-center gap-2 min-h-11 text-cream underline decoration-brass underline-offset-[6px] hover:text-brass" @click="choice.person.value = item.name">{{ item.bookLabel || block.bookLabel }}</NuxtLink>
    </UCarousel>
  </section>
</template>
