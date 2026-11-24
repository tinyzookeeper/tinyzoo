<script setup lang="ts">
// Lhůty's questions: on a tinted band, the heading on the left and on the right every question
// as a row between rules that opens to its answer. The first one is open.
import type { Question } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
</script>

<template>
  <section :id="anchor" class="bg-tint">
    <div class="wrap grid gap-8 py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="label text-quiet"><span class="ticks" />{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] leading-[1.15] sm:text-[42px]" :class="block.eyebrow ? 'mt-5' : ''"><KitMarked :text="block.heading" /></component>
      </div>
      <div v-if="items.length" class="border-t border-ink lg:col-span-8">
        <details v-for="(q, i) in items" :key="q.id" class="group border-b" :class="i === items.length - 1 ? 'border-ink' : 'border-line'" :open="i === 0">
          <summary class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[18px] font-semibold hover:text-signal-text">{{ tidyText(q.question) }}<UIcon name="i-lucide-plus" class="size-[18px] shrink-0 transition-transform group-open:rotate-45" aria-hidden="true" /></summary>
          <p class="max-w-[64ch] pb-6 text-[16px] leading-[1.6] text-ink/85">{{ tidyText(q.answer) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
