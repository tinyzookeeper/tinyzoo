<script setup lang="ts">
// Dres's league table: a black block with the club's place as a huge numeral beside the table,
// the club's own row filled with the club colour.
import type { TableView } from '../../composables/useClub'

const props = defineProps<{ block: BlockOf<'table'>; first?: boolean; anchor?: string; table: TableView }>()
const words = useSiteWords()
const dot = { V: 'bg-brand text-brand-ink', R: 'bg-paper/25', P: 'shadow-[inset_0_0_0_2px] shadow-paper/50' } as const
const formLabel = computed(() => props.table.form.map((o) => capital(words.value.outcome[o])).join(', '))
</script>

<template>
  <section :id="anchor" class="dark mt-16 scroll-mt-0 bg-ink text-paper lg:mt-24">
    <div class="wrap grid gap-10 py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
      <div class="lg:col-span-4">
        <div class="cap text-paper/70"><component :is="first ? 'h1' : 'h2'" class="inline">{{ plainEmphasis(block.heading) }}</component><template v-if="block.competition"> · {{ block.competition }}</template></div>
        <template v-if="table.ours">
          <p class="wide mt-4 text-[clamp(120px,17vw,250px)] !leading-[.8] text-brand-lite">{{ table.ours.place }}.</p>
          <p class="wide mt-5 text-[22px] lg:text-[26px]">{{ words.placeAfterRounds(table.ours.row.played) }}</p>
        </template>
        <p v-if="block.asideText" class="mt-5 max-w-sm text-paper/80">{{ tidyText(block.asideText) }}</p>
        <div v-if="table.form.length" class="mt-7">
          <p class="cap text-paper/70">{{ words.lastFive }}</p>
          <div class="mt-3 flex gap-1.5" :aria-label="formLabel">
            <span v-for="(o, i) in table.form" :key="i" class="dot" :class="dot[o]">{{ o }}</span>
          </div>
        </div>
      </div>
      <div class="lg:col-span-8">
        <table class="w-full tabular-nums">
          <caption class="sr-only">{{ words.tableOf(block.competition ?? '', table.ours ? words.afterRound(table.ours.row.played) : '') }}</caption>
          <thead>
            <tr class="cap text-paper/70">
              <th class="w-11 pb-3 pl-3 text-left font-bold sm:w-14" scope="col">#</th>
              <th class="pb-3 text-left font-bold" scope="col">{{ words.club }}</th>
              <th class="w-9 pb-3 text-right font-bold sm:w-12" scope="col"><abbr :title="words.abbr.played" class="no-underline">{{ words.abbr.played[0] }}</abbr></th>
              <th class="hidden w-12 pb-3 text-right font-bold sm:table-cell" scope="col"><abbr :title="words.abbr.wins" class="no-underline">{{ words.abbr.wins[0] }}</abbr></th>
              <th class="hidden w-12 pb-3 text-right font-bold sm:table-cell" scope="col"><abbr :title="words.abbr.draws" class="no-underline">{{ words.abbr.draws[0] }}</abbr></th>
              <th class="hidden w-12 pb-3 text-right font-bold sm:table-cell" scope="col"><abbr :title="words.abbr.losses" class="no-underline">{{ words.abbr.losses[0] }}</abbr></th>
              <th class="w-16 pb-3 text-right font-bold sm:w-24" scope="col">{{ words.scoreHead }}</th>
              <th class="w-14 pb-3 pr-3 text-right font-bold sm:w-20" scope="col"><abbr :title="words.pointsHead" class="no-underline sm:hidden">{{ words.pointsShort }}</abbr><span class="hidden sm:inline">{{ words.pointsHead }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in table.rows" :key="r.id" :class="r.ours ? 'bg-brand text-brand-ink' : 'border-t border-paper/15'">
              <td class="wide py-3 pl-3 text-[13px] sm:text-[15px]" :class="r.ours ? '' : 'text-paper/60'">{{ i + 1 }}</td>
              <th scope="row" class="head py-3 text-left text-[16px] sm:text-[19px]" :class="r.ours ? '' : '!font-medium'">{{ r.club }}</th>
              <td class="py-3 text-right">{{ r.played }}</td>
              <td class="hidden py-3 text-right sm:table-cell">{{ r.wins }}</td>
              <td class="hidden py-3 text-right sm:table-cell">{{ r.draws }}</td>
              <td class="hidden py-3 text-right sm:table-cell">{{ r.losses }}</td>
              <td class="py-3 text-right">{{ r.score }}</td>
              <td class="wide py-3 pl-2 pr-3 text-right text-[15px] sm:text-[20px]">{{ r.points }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="block.note" class="mt-4 text-sm text-paper/70">{{ block.note }}</p>
      </div>
    </div>
  </section>
</template>
