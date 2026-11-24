<script setup lang="ts">
// Soutisk's questions: rounded boxes, the plus turning to a cross when one opens, and a line
// beside them that sends whoever misses an answer to the phone.
import type { Question } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'faq'>; first?: boolean; anchor?: string; items: Question[] }>()
const { settings } = await useEvent()
</script>

<template>
  <section :id="anchor" class="bg-paper pb-24 sm:pb-36" :class="first ? 'pt-10' : ''">
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-8">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 text-lg text-quiet"><KitMarked :text="block.text" as="a" :attrs="{ href: telHref(settings?.phone ?? ''), class: 'font-bold text-ink underline underline-offset-4 decoration-2 whitespace-nowrap' }" /></p>
      </div>
      <div class="lg:col-span-8 space-y-3">
        <details v-for="(q, i) in items" :key="q.id" class="group rounded-[28px] bg-paper2 px-6 sm:px-7" :open="i < 1">
          <summary class="flex items-center justify-between gap-6 min-h-[68px] py-3 cursor-pointer font-bold text-xl leading-snug">{{ q.question }}<span class="flex-none inline-flex items-center justify-center w-10 h-10 rounded-full bg-ink text-paper transition-transform group-open:rotate-45"><UIcon name="i-lucide-plus" aria-hidden="true" /></span></summary>
          <p class="pb-6 max-w-[42rem]">{{ tidyText(q.answer) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
