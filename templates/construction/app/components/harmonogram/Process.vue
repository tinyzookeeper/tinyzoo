<script setup lang="ts">
// Harmonogram's schedule: the steps before the build, then a real Gantt chart (a bar for each
// stage on a grid of weeks, the days of inspection as diamonds, the payments as squares with
// their share, a laser at the handover), then the steps after.
const props = defineProps<{ block: BlockOf<'process'>; first?: boolean; anchor?: string }>()
const words = useSiteWords()
const before = computed(() => stepsOf(props.block, 'before'))
const after = computed(() => stepsOf(props.block, 'after'))
const build = computed(() => stagesOf(props.block))
const days = computed(() => inspectionWeeks(props.block.inspectionEvery, build.value.total))
const payments = computed(() => build.value.stages.filter((s) => s.step.payment))
// The numbers over the grid: every fourth week, the odd ones only from a tablet up.
const ticks = computed(() => Array.from({ length: Math.ceil(Math.max(build.value.total - 3, 0) / 4) }, (_, i) => ({ week: i * 4 + 1, narrow: i % 2 === 1 })))
</script>

<template>
  <section :id="anchor" class="mt-20 scroll-mt-20 border-y border-line bg-surface py-16 lg:mt-28 lg:py-24">
    <div class="wrap">
      <div class="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="text-[40px] font-extrabold leading-[.95] tracking-[-.04em] text-text sm:text-[64px]" :class="block.eyebrow ? 'mt-3' : ''"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
        </div>
        <p v-if="block.text" class="max-w-[32em] leading-[1.6] text-quiet lg:col-span-5">{{ tidyText(block.text) }}</p>
      </div>

      <!-- before -->
      <ol v-if="before.length" class="mt-12 grid border-t border-line md:grid-cols-3">
        <li v-for="(s, i) in before" :key="i" class="border-b border-line py-6 md:border-b-0" :class="[i < before.length - 1 ? 'md:border-r' : '', i === 0 ? 'md:pr-8' : i === before.length - 1 ? 'md:pl-8' : 'md:px-8']">
          <p class="num flex justify-between text-[13px]"><span class="mono">{{ words.phases.before }}</span><span class="text-brand">{{ durationOf(s, words) }}</span></p>
          <h3 class="mt-3 text-[22px] font-bold tracking-[-.02em] text-text">{{ s.name }}</h3>
          <p class="mt-2 text-[15px] leading-relaxed text-quiet">{{ tidyText(s.text) }}</p>
        </li>
      </ol>

      <!-- the chart -->
      <div v-if="build.stages.length" class="mt-4 border-t-2 border-text pt-5" :style="{ '--w': build.total }">
        <div class="grid gap-x-8 lg:grid-cols-[340px_1fr]">
          <p class="mono hidden lg:block">{{ words.stage }}</p>
          <div class="num grid text-[11px] text-quiet" :style="{ gridTemplateColumns: `repeat(${build.total}, 1fr)` }" aria-hidden="true">
            <span v-for="t in ticks" :key="t.week" :class="t.narrow ? 'hidden sm:block' : ''" :style="{ gridColumn: t.week }">{{ t.week }}</span>
            <span class="hidden text-right text-brand sm:block" :style="{ gridColumn: `${Math.max(build.total - 2, 1)} / span 3` }">{{ words.weekLabel(build.total) }}</span>
          </div>
        </div>
        <ol class="relative mt-2">
          <li v-for="(st, i) in build.stages" :key="i" class="grid gap-x-8 gap-y-2 border-t border-line py-4 lg:grid-cols-[340px_1fr] lg:items-center">
            <div><div class="flex items-baseline justify-between gap-3"><h3 class="text-[19px] font-bold tracking-[-.015em] text-text">{{ st.step.name }}</h3><span class="num text-[14px] text-brand">{{ durationOf(st.step, words) }}</span></div><p class="mt-1 text-[14px] leading-snug text-quiet">{{ tidyText(st.step.text) }}</p></div>
            <div class="track"><span class="bar" :style="{ '--s': st.start, '--d': st.weeks }" /></div>
          </li>
          <li v-if="block.inspectionTitle && days.length" class="grid gap-x-8 gap-y-2 border-t border-line py-4 lg:grid-cols-[340px_1fr] lg:items-center">
            <div><div class="flex items-baseline justify-between gap-3"><h3 class="text-[19px] font-bold tracking-[-.015em] text-text">{{ block.inspectionTitle }}</h3><span class="num text-[14px] text-brand">{{ days.length }}×</span></div><p class="mt-1 text-[14px] leading-snug text-quiet">{{ tidyText(block.inspectionText) }}</p></div>
            <div class="track" aria-hidden="true"><i v-for="w in days" :key="w" class="kd" :style="{ '--at': w }" /></div>
          </li>
          <li v-if="block.paymentsTitle && payments.length" class="grid gap-x-8 gap-y-2 border-y border-line py-4 lg:grid-cols-[340px_1fr] lg:items-center">
            <div><div class="flex items-baseline justify-between gap-3"><h3 class="text-[19px] font-bold tracking-[-.015em] text-text">{{ block.paymentsTitle }}</h3><span class="num text-[14px] text-brand">{{ payments.length }}×</span></div><p class="mt-1 text-[14px] leading-snug text-quiet">{{ tidyText(block.paymentsText) }}</p></div>
            <div class="track mt-4 lg:mt-0" aria-hidden="true"><i v-for="(st, i) in payments" :key="i" class="pay" :style="{ '--at': st.end }"><b :style="i === payments.length - 1 ? { right: '8px' } : undefined">{{ st.step.payment }} %</b></i></div>
          </li>
          <!-- the handover line: the date from the contract -->
          <li class="pointer-events-none absolute inset-y-0 right-0 hidden w-[calc(100%-372px)] lg:block" aria-hidden="true"><span class="laser-v right-0" /></li>
        </ol>
      </div>

      <!-- after -->
      <ol v-if="after.length" class="grid md:grid-cols-3">
        <li v-for="(s, i) in after" :key="i" class="border-b border-line py-6 md:border-b-0" :class="[after.length === 2 && i === 1 ? 'md:col-span-2 md:pl-8' : i < after.length - 1 ? 'md:border-r md:pr-8' : 'md:pl-8']">
          <p class="num flex justify-between text-[13px]"><span class="mono" :class="i === 0 ? '!text-brand' : ''">{{ i === 0 ? words.weekLabel(build.total) : words.afterHandover }}</span><span class="text-brand">{{ durationOf(s, words) }}</span></p>
          <h3 class="mt-3 text-[22px] font-bold tracking-[-.02em] text-text">{{ s.name }}</h3>
          <p class="mt-2 text-[15px] leading-relaxed text-quiet" :class="i > 0 ? 'max-w-[42em]' : ''">{{ tidyText(s.text) }}</p>
          <div v-if="i === after.length - 1 && i > 0" class="mt-4 h-[18px] bg-[linear-gradient(to_right,var(--brand),transparent)] opacity-80" aria-hidden="true" />
        </li>
      </ol>
    </div>
  </section>
</template>
