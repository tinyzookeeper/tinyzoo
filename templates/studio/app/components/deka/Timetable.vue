<script setup lang="ts">
// Deka's timetable: on a desktop a blanket, one row for each day, the classes from morning to
// evening as blocks in their kind's colour whose width follows their length (a full class is a
// dashed outline); on a phone and a tablet a list by day, each day a row that opens (today's is
// open). The legend of colours is the filter; what does not match fades and the pattern stays.
import type { LessonKind } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'timetable'>; first?: boolean; anchor?: string; slots: Slot[]; kinds: LessonKind[] }>()
const { words } = await useStudio()
const tt = useTimetable(() => props.slots)
const { state, week, matching, perDay, total } = tt
const signup = anchorOf('signup')

const todayIndex = computed(() => week.value?.todayIndex ?? -1)
const weekText = computed(() => (week.value ? weekLabel(week.value.dates, words.value.months, 'words') : ''))
const byDay = (d: DayId) => props.slots.filter((s) => s.day === d)
const th = (s: Slot | { kindIndex: number }) => `th${threadOf(s.kindIndex)}`
// The longest day sets the scale of the blanket: a class is as wide as its share of it.
const longest = computed(() => Math.max(0, ...DAY_IDS.map((d) => byDay(d).reduce((sum, s) => sum + s.endMin - s.startMin, 0))))
const gapBefore = (list: Slot[], i: number) => i > 0 && list[i]!.startMin - list[i - 1]!.endMin > 150
const count = computed(() => (total.value === props.slots.length ? `${words.value.lessonsCount(props.slots.length)} ${words.value.weekly}` : words.value.shown(total.value, props.slots.length)))
const kindIndex = (k: LessonKind) => props.kinds.findIndex((x) => x.id === k.id)
const levelOf = (s: Slot) => words.value.levelsDeka[s.level]
</script>

<template>
  <section :id="anchor" class="wrap pb-16 md:pb-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end pt-12 md:pt-16 border-t-[1.5px] border-ink">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow || weekText" class="eyebrow">{{ block.eyebrow }} <span>{{ weekText }}</span></p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" /></component>
      </div>
      <p class="lg:col-span-5"><span class="hidden xl:inline">{{ `${words.weekHint} ` }}</span>{{ tidyText(block.text) }}</p>
    </div>

    <div class="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div class="chips" role="group" :aria-label="words.kindOfClass">
        <button type="button" class="chip" :aria-pressed="state.kind === ''" @click="tt.setKind('')">{{ words.all }}</button>
        <button v-for="k in kinds" :key="k.id" type="button" class="chip" :aria-pressed="state.kind === k.id" @click="tt.setKind(k.id)"><span class="sw" :class="th({ kindIndex: kindIndex(k) })" />{{ k.shortName || k.name }}</button>
      </div>
      <div class="flex items-center gap-2">
        <label class="sr-only" for="tt-level">{{ words.level }}</label>
        <select id="tt-level" v-model="state.level" class="sel flex-1 md:flex-none">
          <option value="">{{ words.allLevels }}</option>
          <option value="z">{{ words.levelPick.z }}</option>
          <option value="m">{{ words.levelPick.m }}</option>
          <option value="p">{{ words.levelPick.p }}</option>
        </select>
        <label class="chip cursor-pointer"><input v-model="state.free" type="checkbox" class="sr-only">{{ words.onlyFree }}</label>
      </div>
    </div>

    <div class="wk mt-6" :style="{ '--max': longest + 16 }">
      <section v-for="(d, i) in words.days" :key="d.id" class="wd" :class="{ 'is-today': i === todayIndex, 'is-open': state.open.includes(d.id), 'is-none': !perDay[d.id] }" :data-day="d.id">
        <button type="button" class="wd-head" :aria-expanded="state.open.includes(d.id)" @click="tt.toggleOpen(d.id)">
          <span><span class="wd-name">{{ d.long }}</span> <span class="wd-date">{{ week ? dayMonth(week.dates[i]!) : '' }}</span></span>
          <span class="wd-today">{{ words.todayTag }}</span><span class="wd-count">{{ words.lessonsCount(perDay[d.id] ?? 0) }}</span><UIcon name="i-lucide-chevron-down" class="wd-chev size-[1em]" aria-hidden="true" />
        </button>
        <div class="wd-row">
          <a
            v-for="(s, n) in byDay(d.id)" :key="s.id" class="pt" :class="[th(s), { 'is-full': seatsOf(s.free) === 'full', 'is-low': seatsOf(s.free) === 'low', 'gap': gapBefore(byDay(d.id), n), 'is-off': !matching.has(s.id) }]"
            :href="signup ? `#${signup}` : undefined" :style="{ '--dur': s.endMin - s.startMin }" :data-lesson="s.id" @click="pickSlot(s)"
          >
            <span class="pt-in">
              <span class="pt-time"><span class="t1">{{ s.start }}</span><span class="t2">{{ s.end }}</span></span>
              <span class="pt-name">{{ tidyText(s.title) }}</span>
              <span class="pt-who">{{ s.first }}<span class="ln">{{ ` ${s.last}` }}</span> · {{ s.room }}</span>
              <span class="pt-lvl"><span v-if="LEVEL_MARKS[s.level]" class="dia" aria-hidden="true"><i v-for="m in 3" :key="m" :class="{ on: m <= LEVEL_MARKS[s.level] }" /></span>{{ levelOf(s) }}</span>
              <span class="pt-free" :title="words.ofPlaces(s.capacity)">{{ words.freeDeka(s.free) }}</span>
            </span>
          </a>
        </div>
        <p class="wd-none">{{ words.noneThatDayDeka }}</p>
      </section>
    </div>

    <div class="mt-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 text-[0.9rem] text-quiet">
      <p aria-live="polite"><span>{{ count }}</span> · <span class="inline-flex items-center gap-1.5 text-ink"><span class="inline-block w-5 h-3 rounded-[3px] border-[1.5px] border-dashed border-ink/60" /> {{ words.fullClass }}</span> · <span class="inline-flex items-center gap-1.5 text-ink"><span class="dia"><i class="on" /><i /><i /></span> {{ words.upTo }} <span class="dia"><i class="on" /><i class="on" /><i class="on" /></span> {{ words.difficulty }}</span></p>
      <NuxtLink v-if="block.printLabel && block.printUrl" class="tlink" :to="siteHref(block.printUrl)">{{ block.printLabel }} <UIcon name="i-lucide-download" class="size-[1em]" aria-hidden="true" /></NuxtLink>
    </div>
  </section>
</template>
