<script setup lang="ts">
// Magnets' questions: a question as the heading, and the questions as rounded tiles that open to
// their answer on sky blue, the first one open.
import type { Question } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
const contactHref = `/#${anchorOf('contact')}`
const size = computed(() => byLength(props.block.heading, [[14, 'text-[44px] sm:text-[64px] lg:text-[72px]'], [26, 'text-[36px] sm:text-[48px] lg:text-[56px]']], 'text-[30px] sm:text-[40px] lg:text-[44px]'))
</script>

<template>
  <section :id="anchor" class="wrap py-14 lg:py-24">
    <div class="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="q mt-4" :class="size"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 max-w-[26rem]"><KitMarked :text="block.text" as="a" :attrs="{ class: 'ul font-medium', href: contactHref }" /></p>
      </div>
      <div class="space-y-2.5 lg:col-span-7">
        <details v-for="(q, i) in items" :key="q.id" class="group rounded-[20px] bg-board open:bg-sky" :open="i === 0">
          <summary class="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-5 px-5 py-3 font-display text-[20px] font-bold leading-tight lg:px-7 lg:text-[22px]">{{ tidyText(q.question) }}<span class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink text-cream transition-transform group-open:rotate-45"><UIcon name="i-lucide-plus" class="size-5" aria-hidden="true" /></span></summary>
          <p class="max-w-[40rem] px-5 pb-6 lg:px-7">{{ tidyText(q.answer) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
