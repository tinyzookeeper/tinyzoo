<script setup lang="ts">
// Šanony's case studies, on the soft tone: three cards, each an ink head with who and how long and
// the title, the problem and what was done on paper, and the result on the brand colour. The
// title leads to the case's page.
import type { CaseStudy } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'cases'>; first?: boolean; anchor?: string; items: CaseStudy[] }>()
const { words } = await useOffice()
</script>

<template>
  <section :id="anchor" class="bg-soft">
    <div class="wrap py-16 lg:py-28">
      <div class="grid items-end gap-6 lg:grid-cols-12 lg:gap-8">
        <component :is="first ? 'h1' : 'h2'" class="display lg:col-span-8" :class="displaySize(block.heading)"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
        <p v-if="block.text" class="max-w-[44ch] text-[17px] leading-[1.55] lg:col-span-4">{{ tidyText(block.text) }}</p>
      </div>
      <div v-if="items.length" class="mt-12 grid gap-5 lg:mt-16 lg:grid-cols-3">
        <article v-for="c in items" :key="c.id" class="flex flex-col bg-paper" data-case>
          <header class="bg-ink px-6 py-5 text-paper">
            <p class="kicker text-[12px] text-soft">{{ [beforeComma(c.client), c.duration].filter(Boolean).join(' · ') }}</p>
            <h3 class="mt-2 font-display text-[27px] font-bold leading-[1.1] tracking-[-0.02em] lg:min-h-[2.2em]"><NuxtLink :to="`/pripad/${c.slug}`" class="underline decoration-paper/40 underline-offset-4 hover:decoration-paper">{{ tidyText(c.title) }}</NuxtLink></h3>
          </header>
          <div class="flex-1 space-y-5 px-6 py-6 text-[15.5px] leading-[1.55]">
            <div><p class="kicker text-[12px]">{{ words.problem }}</p><p class="mt-1.5">{{ tidyText(c.problem) }}</p></div>
            <div><p class="kicker text-[12px]">{{ words.whatWeDid }}</p><p class="mt-1.5">{{ tidyText(c.solution) }}</p></div>
          </div>
          <footer class="bg-brand px-6 py-5 text-brand-ink"><p class="kicker text-[12px]">{{ words.result }}</p><p class="mt-1.5 font-display text-[21px] font-bold leading-[1.2] tracking-[-0.01em]">{{ tidyText(c.outcome) }}</p></footer>
        </article>
      </div>
    </div>
  </section>
</template>
