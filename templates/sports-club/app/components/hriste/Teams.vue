<script setup lang="ts">
// Hřiště's teams: a training timetable, teams down and days across, the times as pills. Below a
// desktop's width each team is a soft card with its times as chips.
import type { Squad } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'teams'>; first?: boolean; anchor?: string; squads: Squad[] }>()
const words = useSiteWords()
const days = computed(() => timetableDays(props.squads))
const badgeClass = (s: Squad) => ((s.badge ?? '').length > 2 ? '!tracking-tight text-[16px]' : 'text-[19px]')
const subline = (s: Squad) => [s.competition, s.coach ? words.value.coachOf(s.coachRole, s.coach) : ''].filter(Boolean).join(' · ')
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-28">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
      <component :is="first ? 'h1' : 'h2'" class="disp h2"><span class="slash" aria-hidden="true" /><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="max-w-md text-quiet lg:pb-1">{{ tidyText(block.text) }}</p>
    </div>

    <table class="mt-8 hidden w-full lg:table">
      <caption class="sr-only">{{ words.timetableCaption }}</caption>
      <thead>
        <tr class="eyebrow">
          <th class="w-[40%] pb-3 text-left font-bold" scope="col">{{ words.timetableHead }}</th>
          <th v-for="d in days" :key="d" class="pb-3 font-bold" scope="col">{{ words.day[d].full }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in squads" :key="s.id" class="border-t border-line">
          <th scope="row" class="py-4 pr-4 text-left font-normal">
            <div class="flex items-center gap-4">
              <span class="avatar h-12 w-12" :class="badgeClass(s)" aria-hidden="true">{{ s.badge || s.name[0] }}</span>
              <p class="leading-tight"><span class="block font-display text-[20px] font-extrabold">{{ s.name }}</span><span class="mt-1 block text-[15px] text-quiet">{{ subline(s) }}</span></p>
            </div>
          </th>
          <td v-for="d in days" :key="d" class="px-1.5 py-4 text-center">
            <template v-if="timesOn(s, d).length"><span v-for="t in timesOn(s, d)" :key="t" class="inline-flex h-10 min-w-[5.5rem] items-center justify-center rounded-full bg-brand-soft px-4 font-display text-[16.5px] font-extrabold text-brand" style="font-variant-numeric: tabular-nums">{{ t }}</span></template>
            <span v-else class="inline-block h-1.5 w-1.5 rounded-full bg-line align-middle" aria-hidden="true" />
          </td>
        </tr>
      </tbody>
    </table>
    <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:hidden">
      <li v-for="s in squads" :key="s.id" class="rounded-3xl bg-tint p-4">
        <div class="flex items-center gap-3.5">
          <span class="avatar !bg-white h-12 w-12" :class="badgeClass(s)" aria-hidden="true">{{ s.badge || s.name[0] }}</span>
          <div class="leading-tight"><h3 class="font-display text-[19px] font-extrabold">{{ s.name }}</h3><p class="mt-1 text-[14.5px] text-quiet">{{ subline(s) }}</p></div>
        </div>
        <p v-if="s.trainings.length" class="mt-3.5 flex flex-wrap gap-2"><template v-for="d in days" :key="d"><span v-for="t in timesOn(s, d)" :key="t" class="rounded-full bg-brand-soft px-3 py-1.5 font-display text-[15px] font-extrabold text-brand">{{ words.day[d].short }} {{ t }}</span></template></p>
      </li>
    </ul>
  </section>
</template>
