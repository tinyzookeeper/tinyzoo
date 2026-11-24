<script setup lang="ts">
// Deka's questions: answers in soft cards that open with a round plus, in two columns.
import type { Question } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
const half = computed(() => Math.ceil(props.items.length / 2))
const columns = computed(() => [props.items.slice(0, half.value), props.items.slice(half.value)])
</script>

<template>
  <section :id="anchor" class="wrap pb-16 md:pb-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end pt-12 md:pt-16 border-t-[1.5px] border-ink">
      <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-7"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="lg:col-span-5"><template v-for="(part, i) in emailParts(block.text)" :key="i"><a v-if="part.email" class="tlink !min-h-0 !inline" :href="`mailto:${part.text}`">{{ part.text }}</a><template v-else>{{ tidyText(part.text) }}</template></template></p>
    </div>
    <div class="mt-10 grid lg:grid-cols-2 gap-3 items-start">
      <div v-for="(column, c) in columns" :key="c" class="grid gap-3">
        <details v-for="(q, i) in column" :key="q.id" class="qa" :open="c === 0 && i === 0">
          <summary>{{ tidyText(q.question) }} <span class="qa-icon" aria-hidden="true"><UIcon name="i-lucide-plus" class="size-[1em]" /></span></summary>
          <p class="px-5 pb-5">{{ tidyText(q.answer) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
