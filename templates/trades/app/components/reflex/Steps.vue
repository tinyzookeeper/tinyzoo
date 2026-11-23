<script setup lang="ts">
// Reflex's steps: on a field of the signal colour, four columns under a heavy rule, each with
// a numeral as large as its text. The borders are laid out for four steps; a fifth starts a new row.
defineProps<{ block: BlockOf<'steps'>; first?: boolean; anchor?: string }>()
const CELLS = [
  'py-6 sm:pr-6 lg:px-6 lg:first:pl-0 border-b-2 lg:border-b-0 border-current lg:border-r-2',
  'py-6 sm:pl-6 lg:px-6 border-b-2 lg:border-b-0 border-current sm:border-l-2 lg:border-l-0 lg:border-r-2',
  'py-6 sm:pr-6 lg:px-6 border-b-2 sm:border-b-0 border-current lg:border-r-2',
  'py-6 sm:pl-6 lg:px-6 lg:pr-0 border-current sm:border-l-2 lg:border-l-0',
]
</script>

<template>
  <section :id="anchor" class="on-brand bg-brand text-brand-ink scroll-mt-0">
    <div class="wrap pt-16 md:pt-24 pb-16 md:pb-24">
      <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
      <ol class="mt-10 md:mt-14 grid sm:grid-cols-2 lg:grid-cols-4 border-t-2 border-current">
        <li v-for="(step, i) in block.items" :key="step.id" class="flex sm:block gap-5" :class="CELLS[i % 4]">
          <p class="font-cond font-black text-[5rem] md:text-[7.5rem] leading-[0.8] tabular-nums w-[3.25rem] sm:w-auto shrink-0">{{ i + 1 }}</p>
          <div><h3 class="sm:mt-5 text-[1.625rem] leading-[1.05]">{{ tidyText(step.title) }}</h3>
          <p class="mt-2.5 text-[1.0625rem] leading-[1.42] font-medium">{{ tidyText(step.text) }}</p></div>
        </li>
      </ol>
    </div>
  </section>
</template>
