<script setup lang="ts">
// Paragon's events: leaves of a tear-off calendar, the month on a coloured strip, the day large.
import type { Event } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'events'>; first?: boolean; anchor?: string; events: Event[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-28 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end">
      <component :is="first ? 'h1' : 'h2'" class="lg:col-span-5 h text-[2.5rem] sm:text-[3.3rem] lg:text-[4rem]"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="lg:col-span-7 max-w-[34rem] lg:pb-1">{{ tidyText(block.text) }}</p>
    </div>
    <ol class="mt-9 grid md:grid-cols-3 gap-6 lg:gap-8">
      <li v-for="e in events" :key="e.id" data-event class="sheet flex flex-col">
        <p class="bg-brand text-brand-ink text-center font-bold tracking-[.14em] uppercase text-[.9rem] pt-4 pb-2">{{ eventMonth(e) }}</p>
        <div class="px-6 pt-5 pb-7 text-center border-b border-dashed rule">
          <p class="h text-[4.2rem] lg:text-[4.6rem]">{{ eventDays(e, true) }}</p>
          <p v-if="e.timeNote" class="mt-2">{{ e.timeNote }}</p>
        </div>
        <div class="px-6 pt-5 pb-7">
          <h3 class="h text-[1.55rem] !leading-[1.1]">{{ tidyText(e.title) }}</h3>
          <p v-if="e.text" class="mt-3">{{ tidyText(e.text) }}</p>
        </div>
      </li>
    </ol>
  </section>
</template>
