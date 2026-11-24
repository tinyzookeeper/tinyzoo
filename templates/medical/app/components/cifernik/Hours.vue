<script setup lang="ts">
// Ciferník's opening hours: every open day is a card with a twelve-hour dial, coloured where the
// practice is open and by whom (walk-in, booked only, blood samples), the span in figures and
// the parts of the day with their colour dots. Today's card is outlined and its dial has the
// hands, from the visitor's clock after the page is drawn (useClock). On a phone each day is a
// row: the dial on the left, the text on the right.
import type { OpeningHour } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'hours'>; first?: boolean; anchor?: string; hours: OpeningHour[] }>()
const { settings } = await useMedical()
const { now, week, days, span, words } = useWeek(() => props.hours)

// (written out so that Tailwind finds them)
const COLUMNS = ['lg:grid-cols-1', 'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4', 'lg:grid-cols-5']
const columns = computed(() => COLUMNS[Math.min(days.value.open.length, 5)] ?? 'lg:grid-cols-4')
const closedNames = computed(() => days.value.closed.map((d, i) => (i ? words.value.days[d].toLowerCase() : words.value.days[d])).join(` ${words.value.and} `))
const mark = { class: 'text-ink num' }
</script>

<template>
  <section :id="anchor" class="wrap pt-16 lg:pt-24">
    <div class="grid gap-5 lg:grid-cols-[1fr_auto] items-end">
      <div>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] sm:text-[3.2rem] lg:text-[3.6rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-3 max-w-[36rem] text-[1.08rem]">{{ tidyText(block.text) }}</p>
      </div>
      <ul class="flex flex-wrap gap-2 text-[.97rem] font-semibold text-ink">
        <li v-for="kind in (['walkin', 'booked', 'samples'] as const)" :key="kind" class="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-2"><span class="dot" :style="{ background: KIND_COLOR[kind] }" />{{ words.kinds[kind] }}</li>
      </ul>
    </div>
    <div class="mt-8 grid gap-3 lg:gap-4" :class="columns">
      <article
        v-for="day in days.open" :key="day" :data-day="day" :data-today="now?.day === day || undefined"
        class="panel p-4 lg:p-5 grid grid-cols-[6.4rem_1fr] sm:grid-cols-[8.5rem_1fr] lg:grid-cols-1 gap-x-4 gap-y-3 items-center lg:items-start lg:content-start"
        :class="now?.day === day ? 'shadow-[inset_0_0_0_3px_var(--ink)]' : ''"
      >
        <div class="lg:order-2 lg:px-3 lg:pt-1"><ClockDial :segs="week[day]" :minutes="now?.day === day ? now.minutes : null" :label="words.dialLabel(words.days[day], span(day, true))" /></div>
        <div class="lg:order-1 lg:text-center">
          <h3 class="text-[1.45rem] lg:text-[1.5rem] flex lg:justify-center items-center gap-2.5">{{ words.days[day] }}<span v-if="now?.day === day" class="rounded-full bg-ink text-paper font-sans font-bold text-[.74rem] uppercase tracking-[.08em] px-2.5 py-1">{{ words.todayTag }}</span></h3>
          <p class="disp mt-1 text-[1.75rem] lg:text-[1.7rem] font-medium num leading-tight lg:hidden">{{ span(day, true) }}</p>
        </div>
        <div class="col-span-2 lg:col-span-1 lg:order-3">
          <p class="disp text-[1.7rem] font-medium num leading-tight text-center max-lg:hidden">{{ span(day, true) }}</p>
          <ul class="lg:mt-3 grid gap-1.5 text-[.95rem] leading-snug">
            <li v-for="s in week[day]" :key="s.id" class="grid grid-cols-[.8em_auto_1fr] gap-x-2 items-baseline" :class="isOn(s, now) ? 'font-bold text-ink' : ''"><span class="dot translate-y-[.08em]" :style="{ background: KIND_COLOR[s.kind] }" /><span class="num whitespace-nowrap">{{ shortTime(s.from) }}–{{ shortTime(s.to) }}</span><span>{{ s.note }}</span></li>
          </ul>
        </div>
      </article>
    </div>
    <div v-if="days.closed.length || settings?.closedText || settings?.visitsText" class="mt-4 grid gap-4" :class="days.closed.length && (settings?.closedText || settings?.visitsText) ? 'md:grid-cols-[auto_1fr]' : ''">
      <p v-if="days.closed.length" class="panel px-6 py-5 flex items-center gap-4"><span class="disp text-[1.4rem]">{{ closedNames }}</span><span class="rounded-full bg-track px-3 py-1 font-bold text-ink text-[.92rem]">{{ words.closedTag }}</span></p>
      <p v-if="settings?.closedText || settings?.visitsText" class="panel px-6 py-5">
        <template v-if="settings.closedText"><strong class="text-ink">{{ words.whenClosed }}:</strong> <KitMarked :text="settings.closedText" as="strong" :attrs="mark" /></template><template v-if="settings.visitsText">{{ settings.closedText ? ' ' : '' }}{{ tidyText(settings.visitsText) }}</template>
      </p>
    </div>
  </section>
</template>
