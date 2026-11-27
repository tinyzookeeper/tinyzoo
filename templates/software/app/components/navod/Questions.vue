<script setup lang="ts">
// Návod's questions: ruled rows that open to their answer, the first one open.
import type { Question } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'questions'>; first?: boolean; anchor?: string; items: Question[] }>()
const sections = await usePageSections()
const number = computed(() => sectionNumber(sections.value, 'questions'))
const contactHref = `/#${anchorOf('contact')}`
</script>

<template>
  <section :id="anchor" class="border-t border-ink/15 bg-sheet">
    <div class="wrap grid gap-10 py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="label text-quiet"><span class="text-brand">{{ number }}</span> · {{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" v-bind="cmsField('heading')" class="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink lg:text-[42px]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-[26rem]"><KitMarked :text="block.text" as="a" :attrs="{ class: 'link text-ink', href: contactHref }" /></p>
      </div>
      <div class="border-t border-ink lg:col-span-8">
        <details v-for="(q, i) in items" :key="q.id" class="group border-b border-line" :open="i === 0">
          <summary class="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-6 py-3 text-[18px] font-semibold text-ink hover:text-brand">{{ tidyText(q.question) }}<UIcon name="i-lucide-plus" class="size-5 flex-none transition-transform group-open:rotate-45" aria-hidden="true" /></summary>
          <p class="max-w-[42rem] pb-5">{{ tidyText(q.answer) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
