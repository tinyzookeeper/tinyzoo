<script setup lang="ts">
// Hřiště's league table: a white card on a tinted band, the club's own row in a soft tint of the
// club colour with rounded ends; beside it the photograph and a few words.
import type { TableView } from '../../composables/useClub'

const props = defineProps<{ block: BlockOf<'table'>; first?: boolean; anchor?: string; table: TableView }>()
const words = useSiteWords()
const after = computed(() => (props.table.ours ? words.value.afterRound(props.table.ours.row.played) : ''))
</script>

<template>
  <section :id="anchor" class="mt-16 scroll-mt-0 bg-tint lg:mt-28">
    <div class="wrap grid gap-x-12 gap-y-10 py-14 lg:grid-cols-12 lg:py-24">
      <div class="lg:col-span-8">
        <component :is="first ? 'h1' : 'h2'" class="disp h2"><span class="slash" aria-hidden="true" /><KitMarked :text="block.heading" plain /></component>
        <p class="mt-2 text-quiet">{{ [block.competition, after].filter(Boolean).join(', ') }}</p>
        <div class="mt-6 rounded-[28px] bg-white p-2 sm:p-4 lg:mt-8 lg:p-5">
          <table class="tbl w-full text-[15.5px] sm:text-[16.5px]" style="font-variant-numeric: tabular-nums">
            <caption class="sr-only">{{ words.tableOf(block.competition ?? '', after) }}</caption>
            <thead>
              <tr class="text-left text-[12.5px] uppercase tracking-[.08em] text-quiet">
                <th class="w-10 py-2 pl-2.5 font-bold sm:w-12 sm:pl-4" scope="col"><span class="sr-only">{{ words.place_ }}</span></th>
                <th class="py-2 font-bold" scope="col">{{ words.squad }}</th>
                <th class="w-9 py-2 text-right font-bold sm:w-12" scope="col"><abbr :title="words.abbr.played" class="no-underline">{{ words.abbr.played[0] }}</abbr></th>
                <th class="hidden w-12 py-2 text-right font-bold sm:table-cell" scope="col"><abbr :title="words.abbr.wins" class="no-underline">{{ words.abbr.wins[0] }}</abbr></th>
                <th class="hidden w-12 py-2 text-right font-bold sm:table-cell" scope="col"><abbr :title="words.abbr.draws" class="no-underline">{{ words.abbr.draws[0] }}</abbr></th>
                <th class="hidden w-12 py-2 text-right font-bold sm:table-cell" scope="col"><abbr :title="words.abbr.losses" class="no-underline">{{ words.abbr.losses[0] }}</abbr></th>
                <th class="w-16 py-2 text-right font-bold sm:w-24" scope="col">{{ words.scoreHead }}</th>
                <th class="w-14 py-2 pr-3 text-right font-bold sm:w-20 sm:pr-5" scope="col">{{ words.pointsHead }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in table.rows" :key="r.id" :class="r.ours ? 'us' : ''">
                <td class="py-2.5 pl-2.5 text-quiet sm:py-3 sm:pl-4" :class="r.ours ? '!font-bold !text-brand' : ''">{{ i + 1 }}.</td>
                <th scope="row" class="py-2.5 text-left font-display leading-tight sm:py-3 sm:text-[17.5px]" :class="r.ours ? 'font-extrabold' : 'font-semibold'">{{ r.club }}</th>
                <td class="py-2.5 text-right text-quiet sm:py-3">{{ r.played }}</td>
                <td class="hidden py-3 text-right text-quiet sm:table-cell">{{ r.wins }}</td>
                <td class="hidden py-3 text-right text-quiet sm:table-cell">{{ r.draws }}</td>
                <td class="hidden py-3 text-right text-quiet sm:table-cell">{{ r.losses }}</td>
                <td class="py-2.5 text-right text-quiet sm:py-3">{{ r.score }}</td>
                <td class="num py-2.5 pr-3 text-right text-[19px] sm:py-3 sm:pr-5 sm:text-[21px]" :class="r.ours ? 'text-brand' : ''">{{ r.points }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="block.note" class="mt-4 text-[15px] text-quiet">{{ block.note }}</p>
      </div>
      <aside v-if="block.image || block.asideHeading || block.asideText" class="grid content-start gap-x-6 gap-y-6 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:pt-2">
        <div v-if="block.image" class="photo"><CmsImage :media="block.image" sizes="(min-width: 1024px) 24rem, 50vw" class="aspect-[4/3] w-full object-cover lg:aspect-[5/4]" /></div>
        <div>
          <h3 v-if="block.asideHeading" class="disp text-[26px] lg:text-[30px]">{{ tidyText(block.asideHeading) }}</h3>
          <p v-if="block.asideText" class="mt-3 text-quiet">{{ tidyText(block.asideText) }}</p>
          <NuxtLink v-if="block.asideLinkLabel" class="more mt-2" :to="siteHref(block.asideLinkUrl)">{{ block.asideLinkLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
        </div>
      </aside>
    </div>
  </section>
</template>
