<script setup lang="ts">
// Ciferník's opening: the waiting-room clock tells whether the practice is open. The hands of
// the clock stand at the visitor's time on today's dial. Everything that depends on the clock
// comes after the page is drawn (useClock); until then the dial is only a face and the pill and
// the legend hold their place empty, so the server's page and the browser's first drawing agree.
import type { OpeningHour } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; hours: OpeningHour[] }>()
const { settings, words, phoneHref } = await useMedical()
const { now, today, span } = useWeek(() => props.hours)

const state = computed(() => {
  const t = today.value
  if (!t) return null
  if (t.open) return words.value.openNow(t.open.to)
  return t.later ? words.value.closedUntil(t.later.from) : words.value.closedNow
})
// the sentence about today that follows the lead
const todayLine = computed(() => {
  const t = today.value
  if (!t) return ''
  if (!t.open) return words.value.seeDials
  const c = t.current
  return !c || c.kind === 'walkin' ? words.value.walkinUntil((c ?? t.open).to) : words.value.justNow(c.note.toLowerCase(), c.to)
})
const dayName = computed(() => (now.value ? words.value.days[now.value.day] : ''))
</script>

<template>
  <section class="wrap pt-8 lg:pt-12 pb-6 grid gap-10 lg:gap-8 lg:grid-cols-[1.05fr_1fr] items-center">
    <div>
      <p class="inline-flex items-center gap-2.5 rounded-full bg-card pl-3 pr-4 py-2 font-bold text-ink">
        <span class="relative flex size-3.5" :class="today ? '' : 'invisible'">
          <span v-if="today?.open" class="absolute inset-0 rounded-full bg-ok opacity-30 scale-[1.9]" />
          <span class="relative size-3.5 rounded-full" :class="today?.open ? 'bg-ok' : 'bg-quiet'" />
        </span>
        <span data-open-state>{{ state ?? '\u00A0' }}</span>
      </p>
      <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[2.75rem] sm:text-[3.6rem] lg:text-[4.3rem] leading-[1.02]"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.lead || todayLine" class="mt-5 text-[1.15rem] max-w-[33rem]">{{ tidyText(block.lead) }} <span>{{ tidyText(todayLine) }}</span></p>
      <div class="mt-7 flex flex-wrap gap-3">
        <a v-if="phoneHref && settings?.phone" :href="phoneHref" class="btn btn-brand num max-sm:grow"><UIcon name="i-lucide-phone" class="ic" aria-hidden="true" />{{ settings.phone }}</a>
        <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn btn-line max-sm:grow">{{ block.primaryLabel }}</NuxtLink>
      </div>
      <p v-if="settings?.accepting" class="mt-7 flex items-center gap-3 text-ink font-bold">
        <span class="grid place-items-center size-10 rounded-full bg-ok text-white shrink-0"><UIcon name="i-lucide-check" class="ic size-[22px]" aria-hidden="true" /></span>
        <span>{{ words.accepting }} <span class="font-normal text-body">{{ settings.acceptingNote }}</span></span>
      </p>
    </div>

    <div>
      <div class="relative pb-[9%]">
        <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 28rem, 70vw" class="arch ml-auto w-[66%] aspect-[4/5] object-cover" />
        <div class="absolute left-0 bottom-0 w-[60%] rounded-full bg-paper p-[2.2%]">
          <ClockDial big :segs="today?.segs ?? []" :minutes="now?.minutes ?? null" :label="today ? words.dialLabel(dayName, span(today.day, true)) : ''" />
        </div>
      </div>
      <ul class="mt-5 flex flex-wrap gap-2 text-[.97rem] min-h-[2.6rem]">
        <template v-if="today">
          <li class="py-2 pr-1 font-bold text-ink">{{ words.todayLegend(dayName.toLowerCase()) }}</li>
          <li v-for="s in today.segs" :key="s.id" class="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-2" :class="isOn(s, now) ? 'font-bold text-ink shadow-[inset_0_0_0_2px_var(--ink)]' : ''">
            <span class="dot" :style="{ background: KIND_COLOR[s.kind] }" /><span class="num">{{ shortTime(s.from) }}–{{ shortTime(s.to) }}</span> {{ (s.note.split(',')[0] ?? '').toLowerCase() }}
          </li>
          <li v-if="!today.segs.length" class="py-2">{{ words.legendClosed }}</li>
        </template>
      </ul>
    </div>
  </section>
</template>
