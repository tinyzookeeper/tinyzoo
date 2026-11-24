<script setup lang="ts">
// Tabule's questions: the heading in capitals and a line to write to on the left, answers ruled
// in black that open on the right.
import type { Question } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
</script>

<template>
  <section :id="anchor" class="on-light wrap pb-16 lg:pb-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-8 pt-12 lg:pt-16 border-t-2 border-ink">
      <div class="lg:col-span-5">
        <component :is="first ? 'h1' : 'h2'" class="h2 h2s"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-6 max-w-[24rem]"><template v-for="(part, i) in emailParts(block.text)" :key="i"><a v-if="part.email" class="ulink !min-h-0" :href="`mailto:${part.text}`">{{ part.text }}</a><template v-else>{{ tidyText(part.text) }}</template></template></p>
      </div>
      <div class="lg:col-span-7 border-b-2 border-ink">
        <details v-for="(q, i) in items" :key="q.id" class="qa border-t-2 border-ink" :open="i === 0">
          <summary>{{ tidyText(q.question) }}</summary>
          <p class="pb-6 max-w-[40rem]">{{ tidyText(q.answer) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
