<script setup lang="ts">
// Tabule's timetable: six day tabs, each with a small picture of its day (bars between 7 and 21
// hours, the larger room above, the smaller below, faded where a filter hides a class), and
// the chosen day as a board of large rows. Filters are segmented buttons; on a desktop one more
// switches between a day and the whole week in three columns.
import type { LessonKind } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'timetable'>; first?: boolean; anchor?: string; slots: Slot[]; kinds: LessonKind[] }>()
const { words } = await useStudio()
const tt = useTimetable(() => props.slots)
const { state, week, matching, perDay, total } = tt
const signup = anchorOf('signup')

const todayIndex = computed(() => week.value?.todayIndex ?? -1)
const weekText = computed(() => (week.value ? weekLabel(week.value.dates, words.value.months, 'numbers') : ''))
const rooms = computed(() => roomsOf(props.slots))
const byDay = (d: DayId) => props.slots.filter((s) => s.day === d)
// The picture of a day covers 6:30 to 21:30.
const T0 = 390
const SPAN = 900
const bar = (s: Slot) => ({ left: `${(((s.startMin - T0) / SPAN) * 100).toFixed(2)}%`, width: `${(((s.endMin - s.startMin) / SPAN) * 100).toFixed(2)}%` })
const count = computed(() => (total.value === props.slots.length ? `${words.value.lessonsCount(props.slots.length)} · ${words.value.roomsCount(rooms.value.length)}` : words.value.boardShown(total.value, props.slots.length)))
const noneShown = computed(() => (state.value.view === 'week' ? total.value === 0 : !perDay.value[state.value.day]))
const setLevel = (v: '' | LevelId) => { state.value.level = v }
const levels: Array<['' | LevelId, string]> = [['', 'all'], ['z', 'z'], ['m', 'm'], ['p', 'p']]
const pickDay = (d: DayId) => { tt.setDay(d); state.value.view = 'day' }
</script>

<template>
  <section :id="anchor" class="on-dark bg-ink text-paper">
    <div class="wrap py-16 lg:py-24">
      <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <p class="mono lg:text-right lg:pb-3">{{ words.week }} <span>{{ weekText }}</span><br><span aria-live="polite">{{ count }}</span></p>
      </div>

      <div class="mt-9 grid lg:grid-cols-[auto_1fr_auto] gap-x-10 gap-y-4 items-end">
        <div class="min-w-0">
          <p id="tt-lbl-level" class="mono mb-2 opacity-70">{{ words.level }}</p>
          <div class="seg" role="group" aria-labelledby="tt-lbl-level">
            <button v-for="[value, key] in levels" :key="value" type="button" :aria-pressed="state.level === value" @click="setLevel(value)">{{ key === 'all' ? words.all : words.levels[key as LevelId] }}</button>
          </div>
        </div>
        <div class="min-w-0">
          <p id="tt-lbl-kind" class="mono mb-2 opacity-70">{{ words.kindOfClass }}</p>
          <div class="seg" role="group" aria-labelledby="tt-lbl-kind">
            <button type="button" :aria-pressed="state.kind === ''" @click="tt.setKind('')">{{ words.all }}</button>
            <button v-for="k in kinds" :key="k.id" type="button" :aria-pressed="state.kind === k.id" @click="tt.setKind(k.id)">{{ k.shortName || k.name }}</button>
          </div>
        </div>
        <div class="hidden lg:block">
          <p id="tt-lbl-view" class="mono mb-2 opacity-70">{{ words.show }}</p>
          <div class="seg" role="group" aria-labelledby="tt-lbl-view">
            <button type="button" :aria-pressed="state.view === 'day'" @click="state.view = 'day'">{{ words.viewDay }}</button>
            <button type="button" :aria-pressed="state.view === 'week'" @click="state.view = 'week'">{{ words.viewWeek }}</button>
          </div>
        </div>
      </div>

      <div class="board mt-8" :data-day="state.day" :data-view="state.view">
        <div class="dtabs" role="tablist" :aria-label="words.dayOfWeek">
          <button v-for="(d, i) in words.days" :key="d.id" type="button" role="tab" class="dtab" :class="{ 'is-today': i === todayIndex }" :aria-selected="state.day === d.id" @click="pickDay(d.id)">
            <span class="dtab-top"><span class="dtab-name" :aria-label="d.long">{{ d.short }}</span><span class="dtab-date">{{ week ? dayMonth(week.dates[i]!) : '' }}</span><span class="dtab-today">{{ words.todayTag }}</span></span>
            <span class="mini" aria-hidden="true"><i v-for="s in byDay(d.id)" :key="s.id" :class="[rooms.indexOf(s.room) > 0 ? 'r2' : '', matching.has(s.id) ? '' : 'off']" :style="bar(s)" /></span>
            <span class="dtab-count">{{ words.lessonsCount(perDay[d.id] ?? 0) }}</span>
          </button>
        </div>
        <p class="mono mt-3 opacity-60 text-[0.6875rem] lg:text-[0.75rem]">{{ words.miniHint(rooms[0] ?? '', rooms[1] ?? '') }}</p>
        <div class="panels mt-6 lg:mt-8 border-t-2 border-paper">
          <div v-for="(d, i) in words.days" :key="d.id" class="panel" role="tabpanel" :data-day="d.id">
            <p class="panel-head">{{ d.long }} <small>{{ week ? dayMonth(week.dates[i]!) : '' }}</small></p>
            <a
              v-for="s in byDay(d.id)" :key="s.id" class="brow" :class="{ 'is-full': seatsOf(s.free) === 'full', 'is-low': seatsOf(s.free) === 'low' }"
              :href="signup ? `#${signup}` : undefined" :hidden="!matching.has(s.id)" :data-lesson="s.id" @click="pickSlot(s)"
            >
              <span class="brow-time"><b>{{ s.start }}</b><span>{{ s.end }}</span></span>
              <span class="brow-main"><span class="brow-name">{{ tidyText(s.title) }}</span><span class="brow-who">{{ s.first }} {{ s.last }}<span class="room"> · {{ s.room }}</span></span></span>
              <span class="brow-lvl"><span v-if="s.level !== 'd'" class="bars" aria-hidden="true"><i v-for="n in 3" :key="n" :class="{ on: !LEVEL_MARKS[s.level] || n <= LEVEL_MARKS[s.level] }" /></span>{{ words.levels[s.level] }}</span>
              <span class="brow-room">{{ s.room }}</span>
              <span class="brow-free"><span v-if="s.free === 0" class="tag">{{ words.full }}</span><template v-else><b>{{ s.free }}</b>{{ words.freeWord(s.free) }}<span class="of">{{ ` ${words.courseOf(s.capacity)}` }}</span></template></span>
              <span class="brow-go" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
        <p v-if="noneShown" class="py-8 text-[1.1rem]">{{ words.noneBoard }}</p>
      </div>

      <div class="mt-8 flex flex-wrap items-center justify-between gap-x-10 gap-y-3">
        <p v-if="block.text" class="max-w-[40rem] opacity-80">{{ tidyText(block.text) }}</p>
        <NuxtLink v-if="block.printLabel && block.printUrl" class="ulink mono" :to="siteHref(block.printUrl)">{{ block.printLabel }} <UIcon name="i-lucide-download" class="size-[1em]" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </section>
</template>
