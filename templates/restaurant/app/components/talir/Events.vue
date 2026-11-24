<script setup lang="ts">
// Talíř's events: three big dates in a closed black-ruled box, the heading and a sentence above.
import type { Event } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'events'>; first?: boolean; anchor?: string; events: Event[] }>()
</script>

<template>
  <section :id="anchor" class="border-t-2 border-ink scroll-mt-4">
    <div class="wrap py-16 lg:py-24">
      <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <component :is="first ? 'h1' : 'h2'" class="wide text-[2.5rem] lg:text-[4.4rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="max-w-[26rem] pb-1">{{ tidyText(block.text) }}</p>
      </div>
      <ol class="mt-9 lg:mt-12 grid lg:grid-cols-3 border-2 border-ink divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-ink">
        <li v-for="e in events" :key="e.id" data-event class="p-5 lg:p-8 flex flex-col">
          <p class="num text-[3.4rem] lg:text-[4.4rem] !font-black [font-stretch:62%]">{{ eventDays(e) }}</p>
          <p v-if="e.timeNote" class="cap muted mt-2">{{ e.timeNote }}</p>
          <h3 class="mt-6 lg:mt-10 font-bold text-[1.5rem] leading-tight">{{ tidyText(e.title) }}</h3>
          <p v-if="e.text" class="mt-2">{{ tidyText(e.text) }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>
