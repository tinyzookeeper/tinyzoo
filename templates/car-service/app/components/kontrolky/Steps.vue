<script setup lang="ts">
// Kontrolky's steps: the repair as a gear pattern. The steps stand in two rows, the odd ones above
// and the even ones below a line with the gate; the key step is lit in the brand colour and a step
// marked with a letter (reverse, the warranty) in red. On a phone a list with the small pattern
// beside the text.
defineProps<{ block: BlockOf<'steps'>; first?: boolean; anchor?: string }>()
const col = ['lg:col-start-1', 'lg:col-start-2', 'lg:col-start-3']
const row = ['lg:row-start-1', 'lg:row-start-3']
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-28 scroll-mt-2">
    <div class="grid lg:grid-cols-12 gap-x-14 gap-y-10">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="cap">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
        <div class="mt-5 flex items-center gap-6">
          <svg viewBox="0 0 96 76" class="lg:hidden flex-none w-[92px] h-auto" aria-hidden="true">
            <path d="M16 20V56M48 20V56M80 20V56M16 38H80" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" />
            <circle cx="48" cy="38" r="4" fill="var(--brand)" />
            <g font-family="Oxanium, sans-serif" font-weight="700" font-size="13" text-anchor="middle" fill="#fff"><text x="16" y="13">1</text><text x="48" y="13">3</text><text x="80" y="13">5</text><text x="16" y="73">2</text><text x="48" y="73">4</text><text x="80" y="73" fill="#ff6a57">R</text></g>
          </svg>
          <p v-if="block.text" class="text-quiet max-w-[24em]">{{ tidyText(block.text) }}</p>
        </div>
      </div>
      <ol class="lg:col-span-8 relative grid lg:grid-cols-3 lg:grid-rows-[auto_104px_auto] gap-x-10">
        <!-- the gate (desktop) -->
        <template v-for="c in Math.min(3, Math.ceil(block.steps.length / 2))" :key="c">
          <li class="hidden lg:block row-start-2 relative" :class="col[c - 1]" aria-hidden="true">
            <span class="absolute left-[27px] inset-y-0 w-[2px] bg-white/60" />
            <span v-if="c === 1" class="absolute left-[27px] -right-10 top-1/2 h-[2px] bg-white/60" />
            <span v-else-if="c < Math.ceil(block.steps.length / 2)" class="absolute left-0 -right-10 top-1/2 h-[2px] bg-white/60" />
            <span v-else class="absolute left-0 w-[28px] top-1/2 h-[2px] bg-white/60" />
            <span v-if="block.steps.findIndex((s) => s.key) >= 0 && Math.floor(block.steps.findIndex((s) => s.key) / 2) === c - 1" class="absolute left-[21px] top-1/2 -mt-[7px] w-[14px] h-[14px] rounded-full bg-brand" />
          </li>
        </template>
        <!-- line on a phone -->
        <li class="lg:hidden absolute left-[27px] top-4 bottom-24 w-[2px] bg-white/30" aria-hidden="true" />

        <li v-for="(step, i) in block.steps" :key="step.id" class="relative flex gap-5 lg:gap-0" :class="[col[Math.floor(i / 2)], row[i % 2], i % 2 ? 'lg:flex-col' : 'lg:flex-col-reverse', i < block.steps.length - 1 ? 'pb-9 lg:pb-0' : '']">
          <span class="dig flex-none grid place-items-center w-14 h-14 rounded-full border-2 bg-bg text-[25px] font-semibold" :class="step.mark ? 'border-signal-red text-signal-red' : step.key ? 'border-brand text-brand' : 'border-white/80'">{{ step.mark || i + 1 }}</span>
          <div :class="i % 2 ? 'lg:pt-6' : 'lg:pb-6'">
            <h3 class="text-[25px]" :class="step.mark ? 'text-signal-red' : step.key ? 'text-brand' : ''">{{ step.title }}</h3>
            <p v-if="step.text" class="mt-2.5 text-[16px] leading-[1.6] text-quiet">{{ tidyText(step.text) }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
