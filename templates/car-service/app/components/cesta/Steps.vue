<script setup lang="ts">
// Cesta's steps: the repair as stops on one road. A dark road with a dashed centre line runs
// along the top of the stops (down the left edge on a phone); every stop is a numbered disc.
defineProps<{ block: BlockOf<'steps'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-24 scroll-mt-4">
    <div class="max-w-[760px]">
      <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-2 font-extrabold text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
      <p v-if="block.text" class="mt-5 text-quiet max-w-[30em]">{{ tidyText(block.text) }}</p>
    </div>
    <ol class="road relative mt-12 lg:mt-16 grid gap-x-10" :style="`--stops:${block.steps.length}`">
      <li class="absolute left-4 top-0 bottom-0 w-3 lg:left-0 lg:right-0 lg:top-4 lg:bottom-auto lg:w-auto lg:h-3 rounded-full bg-ink flex justify-center lg:items-center" aria-hidden="true"><span class="lane-v h-full lg:hidden" /><span class="lane w-full hidden lg:block" /></li>
      <li v-for="(step, i) in block.steps" :key="step.id" class="relative pl-16 lg:pl-0 lg:pt-20" :class="i < block.steps.length - 1 ? 'pb-11 lg:pb-0' : ''">
        <span class="num absolute left-0 top-0 grid place-items-center w-11 h-11 rounded-full bg-brand text-brand-ink font-extrabold text-[20px] ring-[6px] ring-white">{{ step.mark || i + 1 }}</span>
        <h3 class="font-bold text-[27px]">{{ step.title }}</h3>
        <p v-if="step.text" class="mt-3 text-[17px] text-quiet">{{ tidyText(step.text) }}</p>
      </li>
    </ol>
  </section>
</template>
