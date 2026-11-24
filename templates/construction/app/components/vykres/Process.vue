<script setup lang="ts">
// Výkres's build: the steps before it as dimension lines, a schematic section of a house beside
// the ruled list of stages, a dimension chain where every stage is as long as its weeks with
// the overall dimension under it, and the steps after.
const props = defineProps<{ block: BlockOf<'process'>; first?: boolean; anchor?: string }>()
const words = useSiteWords()
const before = computed(() => stepsOf(props.block, 'before'))
const after = computed(() => stepsOf(props.block, 'after'))
const build = computed(() => stagesOf(props.block))
// A stage's name stands in the chain where there is room for it: the longer the stage, the narrower the screen it fits on.
const nameIn = (weeks: number) => (weeks >= 8 ? 'hidden md:inline' : weeks >= 5 ? 'hidden lg:inline' : 'hidden')
</script>

<template>
  <section :id="anchor" class="mt-20 scroll-mt-24 bg-card py-20 lg:mt-28 lg:py-28">
    <div class="wrap">
      <div class="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
        <div class="lg:col-span-5">
          <p v-if="block.eyebrow" class="lab mb-3">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] font-light leading-tight tracking-[-.02em] text-ink sm:text-[42px]"><KitMarked :text="block.heading" as="span" /></component>
        </div>
        <p v-if="block.text" class="max-w-[36em] leading-[1.65] lg:col-span-6 lg:col-start-7">{{ tidyText(block.text) }}</p>
      </div>

      <template v-if="before.length">
        <p class="lab mt-14 border-t-2 border-ink pt-4">{{ words.phases.before }}</p>
        <div class="mt-6 grid gap-10 md:grid-cols-3 md:gap-8">
          <div v-for="(s, i) in before" :key="i">
            <div><div class="kota"><span>{{ durationOf(s, words) }}</span></div></div>
            <h3 class="mt-4 font-display text-[20px] font-normal tracking-[-.01em] text-ink">{{ s.name }}</h3>
            <p class="mt-2 text-[15px] leading-relaxed">{{ tidyText(s.text) }}</p>
          </div>
        </div>
      </template>

      <template v-if="build.stages.length">
        <p class="lab mt-16 border-t-2 border-ink pt-4">{{ words.buildTotal(build.total) }}</p>
        <div class="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-8">
          <figure class="lg:col-span-5">
            <svg viewBox="0 0 560 430" class="h-auto w-full text-ink" role="img" :aria-label="words.section">
              <defs>
                <pattern id="vykres-zdivo" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="currentColor" stroke-width="1" /></pattern>
                <pattern id="vykres-beton" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".9" fill="currentColor" /><circle cx="8" cy="8" r=".9" fill="currentColor" /><path d="M4.5 8.5 6 6l1.5 2.5z" fill="none" stroke="currentColor" stroke-width=".6" /></pattern>
                <pattern id="vykres-izolace" width="8" height="14" patternUnits="userSpaceOnUse"><path d="M0 12 2 2l2 10L6 2l2 10" fill="none" stroke="currentColor" stroke-width=".8" /></pattern>
              </defs>
              <!-- ground and earth -->
              <path d="M10 340h82M468 340h82" stroke="currentColor" stroke-width="2" />
              <path d="M18 348l8-8M30 348l8-8M42 348l8-8M66 348l8-8M78 348l8-8M476 348l8-8M488 348l8-8M512 348l8-8M524 348l8-8M536 348l8-8" stroke="currentColor" stroke-width="1" />
              <!-- footings and slab -->
              <rect x="96" y="340" width="36" height="52" fill="url(#vykres-beton)" stroke="currentColor" stroke-width="2" />
              <rect x="428" y="340" width="36" height="52" fill="url(#vykres-beton)" stroke="currentColor" stroke-width="2" />
              <rect x="92" y="326" width="376" height="14" fill="url(#vykres-beton)" stroke="currentColor" stroke-width="2" />
              <!-- walls -->
              <rect x="100" y="186" width="28" height="140" fill="url(#vykres-zdivo)" stroke="currentColor" stroke-width="2" />
              <rect x="432" y="186" width="28" height="40" fill="url(#vykres-zdivo)" stroke="currentColor" stroke-width="2" />
              <rect x="432" y="286" width="28" height="40" fill="url(#vykres-zdivo)" stroke="currentColor" stroke-width="2" />
              <path d="M441 226v60M446 226v60M451 226v60" stroke="currentColor" stroke-width="1" />
              <!-- inner partition -->
              <rect x="292" y="186" width="12" height="140" fill="url(#vykres-zdivo)" stroke="currentColor" stroke-width="1.4" />
              <!-- ceiling and insulation -->
              <rect x="100" y="174" width="360" height="12" fill="url(#vykres-beton)" stroke="currentColor" stroke-width="2" />
              <rect x="128" y="160" width="304" height="14" fill="url(#vykres-izolace)" stroke="currentColor" stroke-width="1" />
              <!-- roof: covering, rafters, timber in section -->
              <path d="M66 200 280 50l214 150" fill="none" stroke="var(--brand)" stroke-width="3" />
              <path d="M84 200 280 63l196 137" fill="none" stroke="currentColor" stroke-width="1" />
              <g fill="var(--card)" stroke="currentColor" stroke-width="1.4"><rect x="102" y="162" width="12" height="12" /><rect x="446" y="162" width="12" height="12" /><rect x="274" y="70" width="12" height="12" /></g>
              <path d="M102 162l12 12M114 162l-12 12M446 162l12 12M458 162l-12 12M274 70l12 12M286 70l-12 12" stroke="currentColor" stroke-width="1" />
              <path d="M190 126h180" stroke="currentColor" stroke-width="1.4" /><path d="M280 82v44" stroke="currentColor" stroke-width="1" />
              <!-- levels -->
              <g font-family="Encode Sans Condensed, sans-serif" font-size="12" fill="currentColor" letter-spacing=".4">
                <path d="M128 326h40" stroke="currentColor" stroke-width="1" /><path d="M148 326l-5-8h10z" fill="currentColor" /><text x="158" y="320">±0,000</text>
                <path d="M286 50h44" stroke="currentColor" stroke-width="1" /><path d="M312 50l-5-8h10z" fill="currentColor" /><text x="322" y="44">+5,950</text>
                <!-- width -->
                <path d="M93 414h374M100 396v24M460 396v24" stroke="currentColor" stroke-width="1" /><path d="M94 420l12-12M454 420l12-12" stroke="currentColor" stroke-width="1.6" />
                <text x="280" y="408" text-anchor="middle">9 500</text>
                <!-- clear height -->
                <path d="M528 180v152M518 186h18M518 326h18" stroke="currentColor" stroke-width="1" /><path d="M522 192l12-12M522 332l12-12" stroke="currentColor" stroke-width="1.6" />
                <text x="520" y="262" text-anchor="middle" transform="rotate(-90 520 262)">2 750</text>
              </g>
            </svg>
            <figcaption class="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              <span class="lab flex items-center gap-2"><i class="hatch hatch-zdivo" />{{ words.hatches.masonry }}</span>
              <span class="lab flex items-center gap-2"><i class="hatch hatch-beton" />{{ words.hatches.concrete }}</span>
              <span class="lab flex items-center gap-2"><i class="hatch hatch-izolace" />{{ words.hatches.insulation }}</span>
              <span class="lab flex items-center gap-2"><i class="hatch hatch-drevo" />{{ words.hatches.timber }}</span>
            </figcaption>
          </figure>

          <ol class="border-t border-ink lg:col-span-7">
            <li v-for="(st, i) in build.stages" :key="i" class="grid grid-cols-[28px_1fr_auto] gap-x-4 py-4 sm:grid-cols-[28px_190px_1fr_auto]" :class="i === build.stages.length - 1 ? 'border-b border-ink' : 'border-b border-hair'">
              <span class="lab pt-1 !text-ink">{{ i + 1 }}</span>
              <h3 class="font-display text-[18px] font-normal tracking-[-.01em] text-ink">{{ st.step.name }}</h3>
              <p class="order-last col-span-2 col-start-2 mt-1 text-[15px] leading-relaxed sm:order-none sm:col-span-1 sm:col-start-auto sm:mt-0">{{ tidyText(st.step.text) }}</p>
              <span class="font-data text-[17px] font-medium text-ink">{{ durationOf(st.step, words) }}</span>
            </li>
            <li v-if="block.inspectionTitle || block.paymentsTitle" class="mt-5 grid gap-5 sm:grid-cols-2">
              <p v-if="block.inspectionTitle" class="bg-tint p-4 text-[15px] leading-relaxed"><strong class="font-medium text-ink">{{ block.inspectionTitle }}</strong> {{ tidyText(block.inspectionText) }}</p>
              <p v-if="block.paymentsTitle" class="bg-tint p-4 text-[15px] leading-relaxed"><strong class="font-medium text-ink">{{ block.paymentsTitle }}</strong> {{ tidyText(block.paymentsText) }}</p>
            </li>
          </ol>
        </div>

        <!-- the dimension chain: every stage as long as it takes -->
        <div class="mt-12" aria-hidden="true">
          <div class="kota-chain">
            <div v-for="(st, i) in build.stages" :key="i" class="kota" :style="{ flex: `${st.weeks} 1 0` }"><span>{{ i + 1 }} <span :class="nameIn(st.weeks)">· {{ st.step.name.toLowerCase() }}</span></span></div>
          </div>
          <div class="mt-1 flex font-data text-[13px] text-quiet">
            <span v-for="(st, i) in build.stages" :key="i" class="text-center" :style="{ flex: `${st.weeks} 1 0` }">{{ st.weeks }}</span>
          </div>
          <div class="mt-4"><div class="kota"><span>{{ words.weeks(build.total) }} {{ block.totalLabel }}</span></div></div>
        </div>
      </template>

      <template v-if="after.length">
        <p class="lab mt-16 border-t-2 border-ink pt-4">{{ words.phases.after }}</p>
        <div class="mt-6 grid gap-10 md:grid-cols-3 md:gap-8">
          <div v-for="(s, i) in after" :key="i" :class="after.length === 2 && i === 1 ? 'md:col-span-2' : ''">
            <div><div class="kota"><span>{{ durationOf(s, words) }}</span></div></div>
            <h3 class="mt-4 font-display text-[20px] font-normal tracking-[-.01em] text-ink">{{ s.name }}</h3>
            <p class="mt-2 max-w-[40em] text-[15px] leading-relaxed">{{ tidyText(s.text) }}</p>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
