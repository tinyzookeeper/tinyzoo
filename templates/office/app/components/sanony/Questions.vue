<script setup lang="ts">
// Šanony's questions, on white: a heavy heading with a photograph of the shelf (not on a phone),
// and every question a heavy row that opens to its answer. The first one is open.
import type { Question } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
</script>

<template>
  <section :id="anchor" class="bg-white">
    <div class="wrap grid gap-8 py-16 lg:grid-cols-12 lg:gap-8 lg:py-28">
      <div class="lg:col-span-5">
        <component :is="first ? 'h1' : 'h2'" class="display" :class="displaySize(block.heading)"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
        <CmsImage v-if="block.image" :media="block.image" sizes="24rem" class="mt-8 hidden aspect-square w-full max-w-[380px] object-cover lg:block" />
      </div>
      <div v-if="items.length" class="border-t-4 border-ink lg:col-span-7">
        <details v-for="(q, i) in items" :key="q.id" class="group" :class="i === items.length - 1 ? 'border-b-4 border-ink' : 'border-b-2 border-ink'" :open="i === 0">
          <summary class="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 font-display text-[21px] font-bold leading-tight tracking-[-0.01em] sm:text-[25px]">{{ tidyText(q.question) }}<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] bg-ink text-paper transition-colors group-hover:bg-brand"><UIcon name="i-lucide-plus" class="size-[1em] transition-transform group-open:rotate-45" aria-hidden="true" /></span></summary>
          <p class="max-w-[62ch] pb-6 text-[16.5px] leading-[1.6]">{{ tidyText(q.answer) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
