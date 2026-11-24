<script setup lang="ts">
// Šachovnice's first visit: four tiles with the numbers set huge, the second in the brand
// colour and the last black.
const props = defineProps<{ block: BlockOf<'firstVisit'>; first?: boolean; anchor?: string }>()
const n = computed(() => props.block.steps.length)
// The heavy lines between the tiles, for one, two (from `sm`) and four (from `lg`) columns: none
// on the outer edge, which the list's own border draws.
const lines = (i: number) => [
  i < n.value - 1 ? 'border-b-2' : '',
  i % 2 === 0 && i < n.value - 1 ? 'sm:border-r-2' : '',
  i >= n.value - (n.value % 2 ? 1 : 2) ? 'sm:border-b-0' : 'sm:border-b-2',
  i % 4 < 3 && i < n.value - 1 ? 'lg:border-r-2' : '',
  i >= n.value - (((n.value - 1) % 4) + 1) ? 'lg:border-b-0' : 'lg:border-b-2',
]
const tone = (i: number) => (i === 1 ? 'bg-brand text-brand-ink' : i === n.value - 1 && i > 1 ? 'on-ink bg-ink text-paper' : '')
</script>

<template>
  <section :id="anchor" class="wrap py-16 md:py-24 scroll-mt-2">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
      <component :is="first ? 'h1' : 'h2'" class="lg:col-span-7" :class="wideHeading(block.heading)">{{ tidyText(block.heading) }}</component>
      <p v-if="block.text" class="lg:col-span-5 max-w-[30rem] text-[18px]">{{ tidyText(block.text) }}</p>
    </div>
    <ol class="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 border-2 border-ink">
      <li v-for="(step, i) in block.steps" :key="step.id" class="p-6 md:p-7 border-ink" :class="[lines(i), tone(i)]">
        <span class="font-display font-extrabold text-[64px] leading-none" :class="i === n - 1 && i > 1 ? 'text-brand' : ''">{{ i + 1 }}</span>
        <h3 class="mt-5 text-[19px] leading-[1.2] font-bold">{{ tidyText(step.heading) }}</h3>
        <p v-if="step.text" class="mt-3 text-[16px]" :class="i === 1 ? 'font-semibold' : ''">{{ tidyText(step.text) }}</p>
      </li>
    </ol>
  </section>
</template>
