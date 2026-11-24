<script setup lang="ts">
// Šuplíky's steps: the repair as a car going up on the lift and down again, four small drawings,
// one for each stop. The drawing follows the stop's place: down, half way up, high up, away.
defineProps<{ block: BlockOf<'steps'>; first?: boolean; anchor?: string }>()
const words = useSiteWords()
// 0: the car stands, 1: half way up, 2: high up, 3: it drives away
const scene = (i: number, n: number) => (i === 0 ? 0 : i === n - 1 ? 3 : i < Math.ceil(n / 2) ? 1 : 2)
</script>

<template>
  <section :id="anchor" class="bg-card py-16 lg:py-24 scroll-mt-4">
    <!-- a small hatchback, nose to the right -->
    <svg width="0" height="0" class="absolute" aria-hidden="true">
      <defs>
        <symbol id="supliky-car" viewBox="0 0 120 46">
          <path fill="var(--brand)" d="M4 34V25q0-5 6-6l18-3L38 5q2-2.5 6-2.5h34q4 0 7 2.5l13 12 13 2.5q5 1.5 5 7v8q0 2-2 2h-9a10.5 10.5 0 0 0-21 0H39a10.5 10.5 0 0 0-21 0H6q-2 0-2-2z" />
          <path fill="var(--card)" d="M43 7h14v10H33zM61 7h17l12 10H61z" />
          <circle cx="28.500" cy="36.500" r="8.500" fill="var(--ink)" /><circle cx="28.500" cy="36.500" r="3.200" fill="var(--card)" />
          <circle cx="94.500" cy="36.500" r="8.500" fill="var(--ink)" /><circle cx="94.500" cy="36.500" r="3.200" fill="var(--card)" />
        </symbol>
      </defs>
    </svg>
    <div class="wrap">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="kicker text-brand">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[42px] sm:text-[60px]">{{ plainEmphasis(block.heading) }}</component>
        </div>
        <p v-if="block.text" class="lg:col-span-5 text-[17px]">{{ tidyText(block.text) }}</p>
      </div>
      <ol class="mt-10 lg:mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
        <li v-for="(step, i) in block.steps" :key="step.id" class="flex sm:block gap-5 items-start">
          <svg viewBox="0 0 240 168" class="flex-none w-[118px] sm:w-full sm:max-w-[300px] h-auto" aria-hidden="true">
            <rect x="22" y="14" width="14" height="140" rx="4" fill="var(--ink)" /><rect x="14" y="148" width="30" height="8" rx="2" fill="var(--ink)" />
            <template v-if="scene(i, block.steps.length) === 0"><rect x="30" y="149" width="186" height="6" rx="3" fill="var(--ink)" /><use href="#supliky-car" x="52" y="96" width="150" height="57.500" /></template>
            <template v-else-if="scene(i, block.steps.length) === 1"><rect x="30" y="103" width="186" height="6" rx="3" fill="var(--ink)" /><use href="#supliky-car" x="52" y="50" width="150" height="57.500" /></template>
            <template v-else-if="scene(i, block.steps.length) === 2"><rect x="30" y="65" width="186" height="6" rx="3" fill="var(--ink)" /><use href="#supliky-car" x="52" y="12" width="150" height="57.500" /></template>
            <template v-else>
              <rect x="30" y="149" width="60" height="6" rx="3" fill="var(--ink)" /><use href="#supliky-car" x="88" y="96" width="150" height="57.500" />
              <g fill="var(--edge)"><rect x="52" y="112" width="26" height="5" rx="2.500" /><rect x="40" y="124" width="38" height="5" rx="2.500" /><rect x="58" y="136" width="20" height="5" rx="2.500" /></g>
            </template>
            <rect x="0" y="156" width="240" height="5" rx="2.500" fill="var(--edge)" />
          </svg>
          <div>
            <p class="num italic text-[20px] text-brand sm:mt-4">{{ step.mark ? step.mark : words.stepNumber(i + 1) }}</p>
            <h3 class="text-[28px] mt-1">{{ step.title }}</h3>
            <p v-if="step.text" class="mt-2.5 text-[16px] text-quiet">{{ tidyText(step.text) }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
