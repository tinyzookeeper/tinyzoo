<script setup lang="ts">
// Zpravodaj's fixtures: text tabs for the teams, the coming matches and the played ones as ruled
// lists, with the league table beside them when it follows this block on the page.
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
const coming = computed(() => own.value.filter((m) => !m.played))
// (the played ones newest first, the coming ones nearest first)
const played = computed(() => own.value.filter((m) => m.played).reverse())
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 pt-16 lg:pt-24">
    <div class="grid gap-14 lg:grid-cols-12 lg:gap-14">
      <div :class="beside ? 'lg:col-span-7' : 'lg:col-span-12'">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <div v-if="squads.length > 1" class="mt-6 flex flex-wrap gap-x-7 border-b border-line" role="tablist" :aria-label="words.teamTabs">
          <button v-for="s in squads" :key="s.id" class="tab" role="tab" type="button" :aria-selected="s.id === squad?.id" @click="active = s.id">{{ s.name }}</button>
        </div>
        <p v-if="squad?.competition" class="mt-4 text-sm text-quiet">{{ squad.competition }}<template v-if="block.season"> · {{ block.season }}</template></p>

        <template v-if="own.length">
          <template v-for="(list, key) in { coming: coming, played: played }" :key="key">
            <template v-if="list.length">
              <h3 class="label !font-sans !text-quiet" :class="key === 'played' ? 'mt-9' : 'mt-7'">{{ key === 'coming' ? block.comingLabel : block.playedLabel }}</h3>
              <ul class="mt-2 border-t border-ink">
                <li v-for="m in list" :key="m.id" data-match :data-played="m.played" class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-b border-line py-3 sm:grid-cols-[5.75rem_1fr_4rem_4.75rem]">
                  <p class="num col-span-2 text-[13px] text-quiet sm:col-span-1 sm:text-[15px]"><span class="font-medium text-ink">{{ weekday(m.at, 'short') }} {{ dayMonth(m.at) }}</span><span class="sm:hidden"><template v-if="m.round"> · {{ words.round(m.round) }}</template> · {{ m.isHome ? words.home : words.away }}</span></p>
                  <p class="leading-snug"><span :class="m.home.us ? 'font-semibold text-ink' : ''">{{ m.home.name }}</span> <span class="text-quiet">–</span> <span :class="m.away.us ? 'font-semibold text-ink' : ''">{{ m.away.name }}</span></p>
                  <p class="hidden text-[13px] text-quiet sm:block">{{ m.isHome ? words.home : words.away }}</p>
                  <p class="num flex items-center justify-end gap-2.5 text-right">
                    <template v-if="m.played"><span class="font-display text-[19px] font-extrabold leading-none text-ink">{{ m.score }}</span><span class="res" :class="`res-${m.outcome}`" :title="words.outcome[m.outcome!]">{{ m.outcome }}</span></template>
                    <span v-else class="font-medium text-ink">{{ m.time }}</span>
                  </p>
                </li>
              </ul>
            </template>
          </template>
        </template>
        <p v-else class="mt-7">{{ words.noMatches }}</p>
        <p v-if="block.moreLabel" class="mt-6"><NuxtLink class="link" :to="siteHref(block.moreUrl)">{{ block.moreLabel }}</NuxtLink></p>
      </div>

      <ZpravodajTableCard v-if="beside" :block="beside" :table="table" :anchor="tableAnchor" class="lg:col-span-5" />
    </div>
  </section>
</template>
