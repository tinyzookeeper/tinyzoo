<script setup lang="ts">
// Výloha's first visit: a line of capitals between two brass rules, then I–IV in gilt letters
// side by side with brass rules between the columns.
const props = defineProps<{ block: BlockOf<'firstVisit'>; first?: boolean; anchor?: string }>()
const words = useSiteWords()
const wide = computed(() => props.block.steps.length > 3)
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28 scroll-mt-4">
    <component :is="first ? 'h1' : 'h2'" class="flanked caps text-brass">{{ tidyText(block.heading) }}</component>
    <ol class="mt-10 grid sm:grid-cols-2 gap-y-10 lg:divide-x divide-brass/40" :class="wide ? 'lg:grid-cols-4' : 'lg:grid-cols-3'">
      <li v-for="(step, i) in block.steps" :key="step.id" class="lg:px-8 lg:first:pl-0 lg:last:pr-0 sm:pr-8">
        <span class="gilt font-display text-[44px] leading-none">{{ words.vyloha.roman(i + 1) }}.</span>
        <h3 class="mt-4 text-[25px] leading-tight">{{ tidyText(step.heading) }}</h3>
        <p v-if="step.text" class="mt-3 text-[16px]">{{ tidyText(step.text) }}</p>
      </li>
    </ol>
  </section>
</template>
