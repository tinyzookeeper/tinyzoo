<script setup lang="ts">
// Sál's questions: the heading and a line to write to on the left, ruled answers that open on the right.
import type { Question } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pb-20 md:pb-28">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-8 pt-10 border-t border-line">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5"><template v-for="(part, i) in emailParts(block.text)" :key="i"><a v-if="part.email" class="text-ink underline underline-offset-4 decoration-1 hover:text-brand" :href="`mailto:${part.text}`">{{ part.text }}</a><template v-else>{{ tidyText(part.text) }}</template></template></p>
      </div>
      <div class="lg:col-span-8 border-b border-line">
        <details v-for="(q, i) in items" :key="q.id" class="qa border-t border-line" :open="i === 0">
          <summary>{{ tidyText(q.question) }} <UIcon name="i-lucide-plus" class="qa-icon size-[1em]" aria-hidden="true" /></summary>
          <p class="pb-6 max-w-[42rem]">{{ tidyText(q.answer) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
