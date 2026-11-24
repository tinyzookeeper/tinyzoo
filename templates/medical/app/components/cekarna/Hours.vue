<script setup lang="ts">
// Čekárna's opening hours: large rows without a table. The day, the whole span in display
// figures, and the parts of the day side by side (time above, note below). Today's row sits on
// a soft band with a "today" tag and a dot at the part that is on now: that comes from the
// visitor's clock after the page is drawn (useClock), so the server's rows have no band yet.
import type { OpeningHour } from '../../lib/cms-content'
import type { DayKey } from '../../utils/site'

const props = defineProps<{ block: BlockOf<'hours'>; first?: boolean; anchor?: string; hours: OpeningHour[] }>()
const { settings } = await useMedical()
const { now, week, days, words } = useWeek(() => props.hours)
// (a space is kept at the end of a template only as text)
const andJoin = computed(() => ` ${words.value.and} `)

const isToday = (day: DayKey) => now.value?.day === day
// A row has a rule above it, except the first and the one that follows today's band.
const ruled = (i: number) => i > 0 && !isToday(days.value.open[i - 1]!)
const closedNames = computed(() => days.value.closed.map((d, i) => (i ? words.value.days[d].toLowerCase() : words.value.days[d])).join(', '))
const closedAfterToday = computed(() => !!days.value.open.length && isToday(days.value.open[days.value.open.length - 1]!))
const mark = { class: 'text-ink num' }
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28">
    <div class="grid gap-5 lg:grid-cols-[1fr_27rem] lg:gap-16 items-end">
      <div>
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem]"><KitMarked :text="block.heading" plain /></component>
      </div>
      <p v-if="block.text" class="text-[1.08rem] lg:pb-2">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-9 lg:mt-12">
      <div
        v-for="(day, i) in days.open" :key="day" :data-day="day" :data-today="isToday(day) || undefined"
        class="grid gap-x-10 gap-y-3 lg:grid-cols-[9.5rem_15.5rem_1fr] lg:items-baseline py-6 lg:py-7 px-5 sm:px-7 lg:px-9"
        :class="isToday(day) ? 'bg-brand-tint rounded-[22px] lg:rounded-[26px]' : `border-t ${ruled(i) ? 'border-line' : 'border-transparent'}`"
      >
        <h3 class="text-[1.35rem] lg:text-[1.45rem] flex items-center gap-3">{{ words.days[day] }}<span v-if="isToday(day)" class="rounded-full bg-brand text-brand-ink px-2.5 py-1 font-sans text-[.75rem] font-semibold tracking-normal leading-none">{{ words.todayTag }}</span></h3>
        <p class="font-display font-semibold tracking-[-0.02em] text-ink text-[1.75rem] lg:text-[1.95rem] leading-tight"><template v-for="(s, k) in stretchesOf(week[day])" :key="s.from"><template v-if="k">{{ andJoin }}</template><span class="whitespace-nowrap">{{ s.from }}–{{ s.to }}</span></template></p>
        <ul class="grid gap-x-8 gap-y-2 sm:grid-cols-3">
          <li v-for="s in week[day]" :key="s.id" class="max-sm:flex max-sm:gap-4 max-sm:items-baseline">
            <p class="num font-semibold text-ink max-sm:w-[6.6rem] max-sm:shrink-0 flex items-center gap-2"><span v-if="isOn(s, now)" class="size-2 rounded-full bg-brand max-sm:hidden" />{{ s.from }}–{{ s.to }}</p>
            <p class="text-[.98rem] leading-snug sm:mt-0.5" :class="isOn(s, now) ? 'text-ink font-semibold' : ''">{{ s.note }}</p>
          </li>
        </ul>
      </div>
      <div v-if="days.closed.length" class="grid gap-x-10 gap-y-1 lg:grid-cols-[9.5rem_15.5rem_1fr] lg:items-baseline py-6 lg:py-7 px-5 sm:px-7 lg:px-9 border-t text-quiet" :class="closedAfterToday ? 'border-transparent' : 'border-line'">
        <h3 class="text-[1.35rem] lg:text-[1.45rem] !text-quiet">{{ closedNames }}</h3>
        <p class="font-display font-semibold tracking-[-0.02em] text-[1.75rem] lg:text-[1.95rem] leading-tight">{{ words.closedWord }}</p>
      </div>
    </div>
    <div v-if="settings?.closedText || settings?.visitsText" class="mt-10 lg:mt-12 grid gap-8 lg:gap-16 md:grid-cols-2">
      <div v-if="settings.closedText">
        <h3 class="text-[1.2rem]">{{ words.whenClosed }}</h3>
        <p class="mt-2"><KitMarked :text="settings.closedText" as="strong" :attrs="mark" /></p>
      </div>
      <div v-if="settings.visitsText">
        <h3 class="text-[1.2rem]">{{ words.homeVisits }}</h3>
        <p class="mt-2">{{ tidyText(settings.visitsText) }}</p>
      </div>
    </div>
  </section>
</template>
