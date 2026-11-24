<script setup lang="ts">
// Hřiště's fixtures: a pill switch for the teams and two soft panels, what is coming and what is
// played. A match is the date on the left, the two teams one under the other with the score, and
// the kick-off or the outcome disc on the right.
import type { Squad } from '../../lib/cms-content'
import type { TableView } from '../../composables/useClub'

const props = defineProps<{
  block: BlockOf<'fixtures'>; first?: boolean; anchor?: string; squads: Squad[]; matches: MatchView[]
  beside: BlockOf<'table'> | null; table: TableView; tableAnchor?: string
}>()
const words = useSiteWords()
const active = ref<string | null>(null)
const squad = computed(() => props.squads.find((s) => s.id === active.value) ?? props.squads[0] ?? null)
const own = computed(() => props.matches.filter((m) => m.squadId === squad.value?.id))
const coming = computed(() => own.value.filter((m) => !m.played))
// (the played ones newest first)
const played = computed(() => own.value.filter((m) => m.played).reverse())
const panels = computed(() => [
  { key: 'coming', label: props.block.comingLabel, list: coming.value, span: '' },
  { key: 'played', label: props.block.playedLabel, list: played.value, span: 'lg:row-span-2' },
])
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-28">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
      <div>
        <component :is="first ? 'h1' : 'h2'" class="disp h2"><span class="slash" aria-hidden="true" /><KitMarked :text="block.heading" plain /></component>
        <p v-if="squad?.competition" class="mt-2 text-quiet"><span>{{ squad.competition }}</span><template v-if="block.season"> · {{ block.season }}</template></p>
      </div>
      <div v-if="squads.length > 1" class="seg w-full sm:w-auto" role="tablist" :aria-label="words.teamTabs">
        <button v-for="s in squads" :key="s.id" role="tab" type="button" :aria-selected="s.id === squad?.id" @click="active = s.id">{{ s.name }}</button>
      </div>
    </div>
    <div class="mt-6 grid items-start gap-4 lg:mt-8 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-6 lg:gap-y-5">
      <div v-for="panel in panels" :key="panel.key" class="rounded-[28px] bg-tint px-4 pb-3 pt-5 sm:px-7 sm:pt-6" :class="panel.span">
        <h3 class="eyebrow">{{ panel.label }}</h3>
        <ul class="mt-2">
          <li v-for="(m, i) in panel.list" :key="m.id" data-match :data-played="m.played" class="grid grid-cols-[6.1rem_1fr_auto] items-center gap-x-2.5 py-3.5 sm:grid-cols-[7.5rem_1fr_auto] sm:gap-x-6" :class="i ? 'border-t border-line' : ''">
            <div class="leading-tight">
              <p class="font-display text-[15.5px] font-extrabold sm:text-[17px]"><span class="font-semibold text-quiet">{{ weekday(m.at, 'short') }}</span> {{ dayMonth(m.at) }}</p>
              <p class="mt-1 whitespace-nowrap text-[12.5px] text-quiet sm:text-[14px]"><span v-if="m.isHome" class="font-bold text-brand">{{ words.home }}</span><template v-else>{{ words.away }}</template><template v-if="m.round"> · {{ words.round(m.round) }}</template></p>
            </div>
            <div class="grid gap-1 font-display text-[15.5px] leading-tight sm:text-[17.5px]">
              <p v-for="side in [m.home, m.away]" :key="side.name" class="flex items-baseline justify-between gap-3"><span :class="side.us ? 'font-extrabold' : 'font-medium text-ink/75'">{{ side.name }}</span><span v-if="m.played" class="num text-[19px] sm:text-[21px]">{{ side.goals }}</span></p>
            </div>
            <span v-if="m.played" class="res" :class="`res-${m.outcome}`"><span class="sr-only">{{ words.outcome[m.outcome!] }}</span><span aria-hidden="true">{{ m.outcome }}</span></span>
            <span v-else class="num min-w-[3.4rem] text-right text-[21px] sm:text-[25px]">{{ m.time }}</span>
          </li>
        </ul>
        <p v-if="!panel.list.length" class="pb-4 pt-2 text-quiet">{{ words.noMatches }}</p>
      </div>
      <div class="px-1 pt-2 sm:px-7 lg:pt-1">
        <p v-if="block.note" class="flex max-w-[34rem] gap-3 text-[16px] text-quiet"><UIcon name="i-lucide-bus" class="mt-1 flex-none text-[20px] text-brand" aria-hidden="true" /><span>{{ tidyText(block.note) }}</span></p>
        <p v-if="block.note2" class="mt-3 text-[15px] text-quiet">{{ block.note2 }}</p>
        <NuxtLink v-if="block.moreLabel" class="more mt-2" :to="siteHref(block.moreUrl)">{{ block.moreLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </section>
</template>
