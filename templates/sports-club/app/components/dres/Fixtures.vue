<script setup lang="ts">
// Dres's fixtures: a segmented switch for the teams and one list of scoreboard rows, home team
// and away team facing each other round the score, which sits in a box coloured by the outcome.
import type { Squad } from '~/lib/cms-content'
import type { TableView } from '~/composables/useClub'

const props = defineProps<{
  block: BlockOf<'fixtures'>; first?: boolean; anchor?: string; squads: Squad[]; matches: MatchView[]
  beside: BlockOf<'table'> | null; table: TableView; tableAnchor?: string
}>()
const words = useSiteWords()
const active = ref<string | null>(null)
const squad = computed(() => props.squads.find((s) => s.id === active.value) ?? props.squads[0] ?? null)
const own = computed(() => props.matches.filter((m) => m.squadId === squad.value?.id))
// The coming matches nearest first, then the played ones, the latest first.
const rows = computed(() => [...own.value.filter((m) => !m.played), ...own.value.filter((m) => m.played).reverse()])
const where = (m: MatchView) => [m.round ? words.value.round(m.round) : '', m.isHome ? words.value.home : words.value.away].filter(Boolean).join(' · ')
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-24">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
      <component :is="first ? 'h1' : 'h2'" class="wide h2">{{ plainEmphasis(block.heading) }}</component>
      <div v-if="squads.length" class="w-full sm:w-auto">
        <div v-if="squads.length > 1" class="flex" role="tablist" :aria-label="words.teamTabs">
          <button v-for="s in squads" :key="s.id" class="seg" role="tab" type="button" :aria-selected="s.id === squad?.id" @click="active = s.id">{{ s.name }}</button>
        </div>
        <p v-if="squad?.competition" class="cap mt-3 lg:text-right">{{ squad.competition }}<template v-if="block.season"> · {{ block.season }}</template></p>
      </div>
    </div>
    <ul v-if="rows.length" class="mt-8 border-t-4 border-ink">
      <li
        v-for="(m, i) in rows" :key="m.id" data-match :data-played="m.played" class="grid grid-cols-[1fr_auto] items-center gap-x-4 border-b border-ink/25 py-3.5 lg:grid-cols-[9.5rem_1fr_auto_1fr_10rem] lg:gap-x-6"
        :class="m.played && (i === 0 || !rows[i - 1]!.played) ? '!border-t-4 !border-t-ink' : ''"
      >
        <p class="col-span-2 mb-1.5 flex items-baseline gap-3 lg:col-span-1 lg:mb-0"><span class="wide text-[15px] lg:text-[20px]"><span class="font-normal">{{ weekday(m.at, 'short') }}</span> {{ dayMonth(m.at, 'slash') }}</span><span class="cap opacity-70 lg:hidden">{{ where(m) }}</span></p>
        <p class="lg:hidden">
          <span class="head block text-[17px] sm:text-[19px]" :class="m.home.us ? '' : '!font-medium opacity-75'">{{ m.home.name }}</span>
          <span class="head block text-[17px] sm:text-[19px]" :class="m.away.us ? '' : '!font-medium opacity-75'">{{ m.away.name }}</span>
        </p>
        <p class="hidden text-right lg:block"><span class="head text-[21px]" :class="m.home.us ? '' : '!font-medium opacity-75'">{{ m.home.name }}</span></p>
        <p class="row-span-1">
          <span v-if="m.played" class="box" :class="`box-${m.outcome}`"><span class="sr-only">{{ words.outcome[m.outcome!] }} </span>{{ m.score }}</span>
          <span v-else class="box box-T">{{ m.time }}</span>
        </p>
        <p class="hidden lg:block"><span class="head text-[21px]" :class="m.away.us ? '' : '!font-medium opacity-75'">{{ m.away.name }}</span></p>
        <p class="cap hidden text-right opacity-70 lg:block">{{ where(m) }}</p>
      </li>
    </ul>
    <p v-else class="mt-8">{{ words.noMatches }}</p>
    <p class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span class="flex items-center gap-2"><span class="inline-block h-4 w-4 bg-brand" /> {{ words.outcome.V }}</span>
      <span class="flex items-center gap-2"><span class="inline-block h-4 w-4" style="background: color-mix(in srgb, var(--ink) 22%, var(--paper))" /> {{ words.outcome.R }}</span>
      <span class="flex items-center gap-2"><span class="inline-block h-4 w-4 bg-ink" /> {{ words.outcome.P }}</span>
      <NuxtLink v-if="block.moreLabel" class="ml-auto font-bold underline decoration-2 underline-offset-4 hover:bg-ink hover:text-paper" :to="siteHref(block.moreUrl)">{{ block.moreLabel }}</NuxtLink>
    </p>
  </section>
</template>
