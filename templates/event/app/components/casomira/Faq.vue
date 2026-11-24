<script setup lang="ts">
// Časomíra's questions: two columns of short questions, the plus turning to a cross when one opens.
import type { Question } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'faq'>; first?: boolean; anchor?: string; items: Question[] }>()
</script>

<template>
  <section :id="anchor" class="border-t border-line py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap">
      <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
      <div class="mt-10 grid lg:grid-cols-2 gap-x-10 border-t border-line">
        <details v-for="(q, i) in items" :key="q.id" class="group border-b border-line" :open="i < 2">
          <summary class="flex items-center justify-between gap-6 min-h-[64px] py-3 cursor-pointer text-xl font-bold tracking-[-0.02em] hover:text-led transition-colors">{{ q.question }}<UIcon name="i-lucide-plus" class="flex-none text-xl text-led transition-transform group-open:rotate-45" aria-hidden="true" /></summary>
          <p class="pb-5 pr-10 text-quiet">{{ tidyText(q.answer) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
