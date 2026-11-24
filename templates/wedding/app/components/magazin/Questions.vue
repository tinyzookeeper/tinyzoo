<script setup lang="ts">
// Magazín's questions: rows under a strong rule, the question on the left, the answer on the right.
import type { Question } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
</script>

<template>
  <section :id="anchor" class="border-t border-line">
    <div class="wrap py-24 lg:py-36">
      <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
      <dl v-if="items.length" class="mt-10 lg:mt-14 border-t border-ink">
        <div v-for="q in items" :key="q.id" class="grid lg:grid-cols-12 gap-x-10 gap-y-3 py-7 lg:py-9 border-b border-line">
          <dt class="lg:col-span-5 serif text-ink text-[1.6rem] lg:text-[1.9rem] leading-[1.15]">{{ tidyText(q.question) }}</dt>
          <dd class="lg:col-span-6 lg:col-start-7 max-w-[38rem]">{{ tidyText(q.answer) }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
