<script setup lang="ts">
// Salon's events: the heading and a sentence beside a ruled list, the date in brass italics.
import type { Event } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'events'>; first?: boolean; anchor?: string; events: Event[] }>()
</script>

<template>
  <section :id="anchor" class="border-t border-line scroll-mt-6">
    <div class="wrap py-20 lg:py-24 grid lg:grid-cols-12 gap-10 lg:gap-14">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 font-display text-[2.4rem] lg:text-[3.3rem] leading-[1.08] tracking-[-.01em]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 text-quiet max-w-[24rem]">{{ tidyText(block.text) }}</p>
      </div>
      <ol class="lg:col-span-8 border-b border-line">
        <li v-for="e in events" :key="e.id" data-event class="grid sm:grid-cols-[11rem_1fr] gap-x-8 gap-y-2 py-7 border-t border-line">
          <p class="font-display italic text-[1.9rem] leading-none text-brand">{{ eventDays(e) }}<span v-if="e.timeNote" class="label block mt-3 text-quiet not-italic">{{ e.timeNote }}</span></p>
          <div>
            <h3 class="text-[1.5rem] leading-tight font-medium">{{ tidyText(e.title) }}</h3>
            <p v-if="e.text" class="mt-2 text-quiet max-w-[34rem]">{{ tidyText(e.text) }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
