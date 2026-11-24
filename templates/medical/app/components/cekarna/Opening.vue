<script setup lang="ts">
// Čekárna's opening: calm text on the left, the waiting room on the right, and under them one
// soft band that says today on a single line: the span, each part of the day with "now",
// tomorrow. Today comes from the visitor's clock after the page is drawn (useClock); until then
// the band holds its place empty, so the server's page and the browser's first drawing agree.
import type { OpeningHour } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; hours: OpeningHour[] }>()
const { settings, words, phoneHref } = await useMedical()
const { now, today, week } = useWeek(() => props.hours)
// (a space is kept at the end of a template only as text)
const andJoin = computed(() => ` ${words.value.and} `)

const headingParts = computed(() => emphasisParts(props.block.heading).map((p) => ({ ...p, text: tidyText(p.text) })))
const state = computed(() => {
  const t = today.value
  if (!t) return null
  if (t.open) return words.value.openNow(t.open.to)
  return t.later ? words.value.closedUntil(t.later.from) : words.value.closedNow
})
const dateLine = computed(() => (now.value ? words.value.todayDate(words.value.days[now.value.day].toLowerCase(), now.value.date, words.value.months[now.value.month]!) : null))
const stretches = computed(() => (today.value ? stretchesOf(today.value.segs) : []))
const nextStretches = computed(() => (today.value?.next ? stretchesOf(today.value.next.segs) : []))
</script>

<template>
  <section class="wrap pt-4 lg:pt-8">
    <div class="grid gap-8 lg:gap-14 lg:grid-cols-[1.18fr_1fr] items-center">
      <div>
        <p class="flex items-center gap-2.5 font-semibold text-ink">
          <span class="relative flex size-3" :class="today ? '' : 'invisible'">
            <span v-if="today?.open" class="absolute inset-0 rounded-full bg-ok opacity-30 scale-[2]" />
            <span class="relative size-3 rounded-full" :class="today?.open ? 'bg-ok' : 'bg-quiet'" />
          </span>
          <span data-open-state>{{ state ?? '\u00A0' }}</span>
        </p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[2.5rem] sm:text-[3.3rem] lg:text-[3.55rem] leading-[1.05]"><template v-for="(part, i) in headingParts" :key="i"><br v-if="part.marked" class="max-lg:hidden">{{ part.text }}</template></component>
        <p v-if="block.lead" class="mt-5 text-[1.15rem] lg:text-[1.2rem] max-w-[32rem]">{{ tidyText(block.lead) }}</p>
        <div class="mt-7 flex flex-wrap items-center gap-3">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn btn-brand max-sm:grow">{{ block.primaryLabel }}</NuxtLink>
          <a v-if="phoneHref && settings?.phone" :href="phoneHref" class="btn btn-soft num max-sm:grow"><UIcon name="i-lucide-phone" class="ic text-brand" aria-hidden="true" />{{ settings.phone }}</a>
        </div>
        <p v-if="settings?.accepting" class="mt-7 flex items-center gap-3 text-ink">
          <span class="grid place-items-center size-8 rounded-full bg-brand-tint text-brand shrink-0"><UIcon name="i-lucide-check" class="ic size-[18px]" aria-hidden="true" /></span>
          <span><strong class="font-semibold">{{ words.accepting }}</strong> {{ settings.acceptingNote }}</span>
        </p>
      </div>
      <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 36rem, 100vw" class="photo w-full aspect-[4/3] lg:aspect-[6/5]" />
    </div>

    <!-- today -->
    <div class="mt-8 lg:mt-10 rounded-[24px] lg:rounded-[28px] bg-tint p-6 sm:p-8 lg:px-10 grid gap-x-12 gap-y-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
      <div>
        <p class="text-[.95rem] text-quiet">{{ dateLine ?? ' ' }}</p>
        <p class="mt-1 font-display font-semibold text-ink text-[2.1rem] lg:text-[2.3rem] leading-none tracking-[-0.02em]">
          <template v-if="!today">&nbsp;</template>
          <template v-else-if="!stretches.length">{{ words.closedWord }}</template>
          <template v-else><template v-for="(s, i) in stretches" :key="s.from"><template v-if="i">{{ andJoin }}</template><span class="whitespace-nowrap">{{ s.from }}–{{ s.to }}</span></template></template>
        </p>
      </div>
      <ul class="grid gap-x-8 gap-y-3 sm:grid-cols-3">
        <li v-for="s in today?.segs ?? []" :key="s.id" :class="isOn(s, now) ? 'text-ink' : ''">
          <p class="num font-semibold text-ink flex items-center gap-2.5">{{ s.from }}–{{ s.to }}<span v-if="isOn(s, now)" class="rounded-full bg-brand text-brand-ink px-2.5 py-0.5 text-[.75rem] font-semibold">{{ words.nowTag }}</span></p>
          <p class="text-[.98rem] leading-snug mt-0.5">{{ s.note }}</p>
        </li>
        <li v-if="today && !today.segs.length">{{ words.noHoursToday }}</li>
      </ul>
      <div class="lg:text-right">
        <p class="text-[.95rem] text-quiet" data-next-open>
          <template v-if="!today?.next">&nbsp;</template>
          <template v-else>{{ today.next.tomorrow ? words.tomorrowLead : words.nextLead }} {{ words.daysIn[today.next.day] }} <template v-for="(s, i) in nextStretches" :key="s.from"><template v-if="i">{{ andJoin }}</template><span class="whitespace-nowrap">{{ s.from }}–{{ s.to }}</span></template></template>
        </p>
        <NuxtLink :to="`/#${anchorOf('hours')}`" class="mt-1 inline-flex min-h-11 items-center gap-2 font-semibold text-brand hover:text-ink transition-colors">{{ words.wholeWeek }} <UIcon name="i-lucide-arrow-down" class="ic" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </section>
</template>
