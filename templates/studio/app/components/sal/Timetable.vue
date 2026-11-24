<script setup lang="ts">
// Sál's timetable: on a desktop a matrix, the days across and morning, afternoon and evening
// down, one white card for each class; on a phone six day tabs and that day's classes as a
// list. Filters: the kinds as chips, a level and "only with places". Today's column is
// tinted; which day is today needs the visitor's clock, so it is marked once the page is mounted.
import type { LessonKind } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'timetable'>; first?: boolean; anchor?: string; slots: Slot[]; kinds: LessonKind[] }>()
const { words } = await useStudio()
const tt = useTimetable(() => props.slots)
const { state, week, matching, perDay, total } = tt
const signup = anchorOf('signup')

const todayIndex = computed(() => week.value?.todayIndex ?? -1)
const weekText = computed(() => (week.value ? weekLabel(week.value.dates, words.value.months, 'words') : ''))
const cells = computed(() => words.value.parts.map((_, p) => DAY_IDS.map((d) => props.slots.filter((s) => s.day === d && partOf(s.startMin) === p))))
const visible = (list: Slot[]) => list.some((s) => matching.value.has(s.id))
const count = computed(() => (total.value === props.slots.length ? `${words.value.lessonsCount(total.value)} ${words.value.weekly}` : words.value.shown(total.value, props.slots.length)))
const levelName = (s: Slot) => words.value.levels[s.level]
</script>

<template>
  <section :id="anchor" class="wrap pb-20 md:pb-28">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 pt-10 border-t border-line">
      <div>
        <p v-if="block.eyebrow || weekText" class="label">{{ block.eyebrow }}<template v-if="block.eyebrow && weekText"> · </template><span>{{ weekText }}</span></p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="max-w-[26rem] text-[0.975rem] leading-relaxed text-quiet">{{ tidyText(block.text) }}</p>
    </div>

    <div class="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div class="chips" role="group" :aria-label="words.kindOfClass">
        <button type="button" class="chip" :aria-pressed="state.kind === ''" @click="tt.setKind('')">{{ words.all }}</button>
        <button v-for="k in kinds" :key="k.id" type="button" class="chip" :aria-pressed="state.kind === k.id" @click="tt.setKind(k.id)">{{ k.shortName || k.name }}</button>
      </div>
      <div class="flex items-center gap-3">
        <label class="sr-only" for="tt-level">{{ words.level }}</label>
        <select id="tt-level" v-model="state.level" class="sel flex-1 md:flex-none">
          <option value="">{{ words.allLevels }}</option>
          <option value="z">{{ words.levelPick.z }}</option>
          <option value="m">{{ words.levelPick.m }}</option>
          <option value="p">{{ words.levelPick.p }}</option>
        </select>
        <label class="chip !gap-2.5 cursor-pointer has-[:checked]:!bg-ink has-[:checked]:!text-paper has-[:checked]:!shadow-none">
          <input v-model="state.free" type="checkbox" class="sr-only">{{ words.onlyFree }}
        </label>
      </div>
    </div>

    <div class="tt mt-6 lg:mt-8" :data-day="state.day">
      <div class="tt-days" role="tablist" :aria-label="words.dayOfWeek">
        <button
          v-for="(d, i) in words.days" :key="d.id" type="button" role="tab" class="tt-day" :class="{ 'is-today': i === todayIndex, 'is-none': !perDay[d.id] }"
          :aria-selected="state.day === d.id" @click="tt.setDay(d.id)"
        >
          <b><span class="short">{{ d.short }}</span><span class="long">{{ d.long }}</span></b>
          <small><span v-if="i === todayIndex" class="n">{{ words.todayDot }}</span>{{ week ? dayMonth(week.dates[i]!) : '' }}</small>
        </button>
      </div>
      <div class="tt-body">
        <div v-for="(part, p) in words.parts" :key="part" class="tt-row" :class="{ 'is-empty-row': !visible(cells[p]!.flat()) }">
          <div class="tt-part">{{ part }}</div>
          <div v-for="(d, i) in words.days" :key="d.id" class="tt-cell" :class="{ 'is-today': i === todayIndex, 'is-empty': !visible(cells[p]![i]!) }" :data-day="d.id">
            <p class="tt-partm">{{ part }}</p>
            <a
              v-for="s in cells[p]![i]!" :key="s.id" class="cls" :class="{ 'is-full': seatsOf(s.free) === 'full', 'is-low': seatsOf(s.free) === 'low' }"
              :href="signup ? `#${signup}` : undefined" :hidden="!matching.has(s.id)" :data-lesson="s.id" @click="pickSlot(s)"
            >
              <span class="cls-time"><span class="t1">{{ s.start }}</span><span class="t2">{{ s.end }}</span></span>
              <span class="cls-free" :title="`${words.freeLong(s.free)} z ${s.capacity}`">{{ words.freeShort(s.free) }}</span>
              <span class="cls-name">{{ tidyText(s.title) }}</span>
              <span class="cls-who">{{ s.first }}<span class="ln">{{ ` ${s.last}` }}</span> · {{ s.room }}</span>
              <span class="cls-lvl"><span v-if="LEVEL_MARKS[s.level]" class="dots" aria-hidden="true"><i v-for="n in 3" :key="n" :class="{ on: n <= LEVEL_MARKS[s.level] }" /></span>{{ levelName(s) }}</span>
            </a>
          </div>
        </div>
      </div>
      <p v-if="!perDay[state.day]" class="mt-6 p-6 rounded-2xl bg-tint text-ink" :class="total > 0 ? 'lg:hidden' : ''">{{ words.noneThatDay }}</p>
    </div>

    <div class="mt-6 pt-5 border-t border-line flex flex-wrap items-center justify-between gap-x-8 gap-y-2 text-[0.9rem] text-quiet">
      <p aria-live="polite"><span>{{ count }}</span> · {{ words.levelColon }} <span class="inline-flex items-center gap-1.5 ml-1"><span class="dots"><i class="on" /><i /><i /></span> {{ words.levels.z.toLowerCase() }}</span> <span class="inline-flex items-center gap-1.5 ml-3"><span class="dots"><i class="on" /><i class="on" /><i /></span> {{ words.levels.m.toLowerCase() }}</span> <span class="inline-flex items-center gap-1.5 ml-3"><span class="dots"><i class="on" /><i class="on" /><i class="on" /></span> {{ words.levels.p.toLowerCase() }}</span></p>
      <NuxtLink v-if="block.printLabel && block.printUrl" class="tlink !font-medium" :to="siteHref(block.printUrl)">{{ block.printLabel }} <UIcon name="i-lucide-download" class="size-[1em]" aria-hidden="true" /></NuxtLink>
    </div>
  </section>
</template>
