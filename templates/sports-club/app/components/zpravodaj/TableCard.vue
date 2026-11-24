<script setup lang="ts">
// The league table as Zpravodaj sets it: ruled, the club's own row tinted. It stands on its own
// (Table.vue) or beside the fixtures (Fixtures.vue).
import type { TableView } from '~/composables/useClub'

defineProps<{ block: BlockOf<'table'>; table: TableView; first?: boolean; anchor?: string }>()
const words = useSiteWords()
</script>

<template>
  <div :id="anchor" class="scroll-mt-6">
    <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
    <p class="mt-6 border-b border-line pb-[13px] text-[15px] font-semibold text-ink lg:min-h-[45px]">{{ block.competition }}<template v-if="table.ours"> <span class="font-normal text-quiet">· {{ words.afterRound(table.ours.row.played) }}</span></template></p>
    <table class="num mt-4 w-full text-[15px]">
      <caption class="sr-only">{{ words.tableOf(block.competition ?? '', table.ours ? words.afterRound(table.ours.row.played) : '') }}</caption>
      <thead>
        <tr class="label border-b border-ink text-left">
          <th class="w-8 py-2.5 font-semibold" scope="col"><span class="sr-only">{{ words.place_ }}</span>#</th>
          <th class="py-2.5 font-semibold" scope="col">{{ words.club }}</th>
          <th class="w-8 py-2.5 text-right font-semibold" scope="col"><abbr :title="words.abbr.played" class="no-underline">{{ words.abbr.played[0] }}</abbr></th>
          <th class="hidden w-8 py-2.5 text-right font-semibold sm:table-cell" scope="col"><abbr :title="words.abbr.wins" class="no-underline">{{ words.abbr.wins[0] }}</abbr></th>
          <th class="hidden w-8 py-2.5 text-right font-semibold sm:table-cell" scope="col"><abbr :title="words.abbr.draws" class="no-underline">{{ words.abbr.draws[0] }}</abbr></th>
          <th class="hidden w-8 py-2.5 text-right font-semibold sm:table-cell" scope="col"><abbr :title="words.abbr.losses" class="no-underline">{{ words.abbr.losses[0] }}</abbr></th>
          <th class="w-16 py-2.5 text-right font-semibold" scope="col">{{ words.scoreHead }}</th>
          <th class="w-10 py-2.5 text-right font-semibold" scope="col"><abbr :title="words.pointsHead" class="no-underline">{{ words.pointsShort }}</abbr></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in table.rows" :key="r.id" class="border-b border-line" :class="r.ours ? 'bg-brand/10 font-semibold text-ink' : ''">
          <td class="py-2.5" :class="r.ours ? 'pl-2 text-brand' : 'text-quiet'">{{ i + 1 }}.</td>
          <th scope="row" class="py-2.5 text-left text-ink" :class="r.ours ? 'font-bold' : 'font-normal'">{{ r.club }}</th>
          <td class="py-2.5 text-right">{{ r.played }}</td>
          <td class="hidden py-2.5 text-right sm:table-cell">{{ r.wins }}</td>
          <td class="hidden py-2.5 text-right sm:table-cell">{{ r.draws }}</td>
          <td class="hidden py-2.5 text-right sm:table-cell">{{ r.losses }}</td>
          <td class="py-2.5 text-right">{{ r.score }}</td>
          <td class="py-2.5 text-right font-bold text-ink" :class="r.ours ? 'pr-2' : ''">{{ r.points }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="block.note" class="mt-4 text-[13px] text-quiet">{{ block.note }}</p>
  </div>
</template>
