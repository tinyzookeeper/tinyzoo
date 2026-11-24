<script setup lang="ts">
// Večer's questions: two ruled columns, the questions in italics.
import type { Question } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
// The last row closes with a rule: the last item, and its neighbour when the count is even.
const closes = (i: number) => props.items.length % 2 === 0 && i === props.items.length - 2
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-36 pb-20 lg:pb-28">
    <div class="text-center max-w-[40rem] mx-auto">
      <span class="stem" aria-hidden="true" />
      <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
    </div>
    <dl v-if="items.length" class="grid md:grid-cols-2 gap-x-20 mt-12 lg:mt-16">
      <div v-for="(q, i) in items" :key="q.id" class="py-8 border-t border-line" :class="i === items.length - 1 ? 'border-b' : closes(i) ? 'md:border-b' : ''">
        <dt class="italic text-ink text-[1.6rem] leading-tight">{{ tidyText(q.question) }}</dt>
        <dd class="mt-3">{{ tidyText(q.answer) }}</dd>
      </div>
    </dl>
  </section>
</template>
