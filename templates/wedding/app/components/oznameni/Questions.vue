<script setup lang="ts">
// Oznámení's questions: two ruled columns on the card-coloured band.
import type { Question } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
// The last row closes with a rule: the last item, and its neighbour when the count is even.
const closes = (i: number) => i === props.items.length - 1 || (props.items.length % 2 === 0 && i === props.items.length - 2)
</script>

<template>
  <section :id="anchor" class="bg-card border-y border-line">
    <div class="wrap py-20 lg:py-28">
      <div class="text-center max-w-[40rem] mx-auto">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.6rem] lg:text-[3.4rem] leading-[1.08] mt-4"><KitMarked :text="block.heading" plain /></component>
      </div>
      <dl v-if="items.length" class="grid md:grid-cols-2 gap-x-16 mt-12 lg:mt-16">
        <div v-for="(q, i) in items" :key="q.id" class="py-7 border-t border-line" :class="i === items.length - 1 ? 'border-b' : closes(i) ? 'md:border-b' : ''">
          <dt class="font-display text-ink text-[1.6rem] leading-tight">{{ tidyText(q.question) }}</dt>
          <dd class="mt-3">{{ tidyText(q.answer) }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
