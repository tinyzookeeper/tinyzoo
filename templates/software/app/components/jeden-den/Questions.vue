<script setup lang="ts">
// One Day's questions, 19:00: the light goes and the questions are asked on dusk blue, each
// opening to its answer, the first one open.
import type { Question } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
const contactHref = `/#${anchorOf('contact')}`
</script>

<template>
  <section :id="anchor" class="dark-band bg-dusk text-cream">
    <div class="wrap lg:grid lg:grid-cols-[150px_1fr]">
      <JedenDenRail class="pt-12 lg:pt-24" :time="block.time" :note="block.timeNote" />
      <div class="grid gap-8 pb-16 pt-6 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pl-14 lg:pt-24">
        <div class="lg:col-span-5">
          <component :is="first ? 'h1' : 'h2'" class="h2 text-[36px] sm:text-[46px] lg:text-[52px]"><KitMarked :text="block.heading" /></component>
          <p v-if="block.text" class="mt-5 max-w-[24rem] opacity-90"><KitMarked :text="block.text" as="a" :attrs="{ class: 'ul font-medium', href: contactHref }" /></p>
        </div>
        <div class="border-t border-cream/30 lg:col-span-7">
          <details v-for="(q, i) in items" :key="q.id" class="group border-b border-cream/30" :open="i === 0">
            <summary class="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-5 py-3 font-display text-[21px] font-semibold leading-tight hover:text-lamp lg:text-[23px]">{{ tidyText(q.question) }}<UIcon name="i-lucide-plus" class="size-[22px] flex-none transition-transform group-open:rotate-45" aria-hidden="true" /></summary>
            <p class="max-w-[40rem] pb-6 opacity-90">{{ tidyText(q.answer) }}</p>
          </details>
        </div>
      </div>
    </div>
  </section>
</template>
