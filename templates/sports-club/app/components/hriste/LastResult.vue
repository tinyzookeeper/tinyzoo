<script setup lang="ts">
// Hřiště's three soft cards under the opening: the last result as two score tiles, the last five
// matches as discs, and the place in the table.
import type { LastView } from '~/composables/useClub'

const props = defineProps<{ block: BlockOf<'lastResult'>; first?: boolean; last: LastView }>()
const { words } = await useClub()
const m = computed(() => props.last.match)
const report = computed(() => m.value?.match.report ?? null)
const formLabel = computed(() => props.last.form.map((o) => words.value.outcome[o]).join(', '))
</script>

<template>
  <section class="wrap pt-4 lg:pt-6" :aria-label="block.resultLabel ?? undefined" :data-last-result="m?.score ?? ''">
    <div class="mx-auto grid max-w-[1180px] gap-3 sm:w-[calc(100%-48px)] sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr] lg:gap-4">
      <div class="rounded-3xl bg-tint p-5 sm:col-span-2 lg:col-span-1 lg:p-6">
        <p class="eyebrow">{{ block.resultLabel }}<template v-if="m"> · {{ weekday(m.at) }} {{ dayMonth(m.at) }}</template></p>
        <div v-if="m" class="mt-3 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 font-display text-[19px] leading-tight">
          <template v-for="(side, i) in [m.home, m.away]" :key="i">
            <span :class="side.us ? 'font-extrabold' : 'font-semibold text-ink/75'">{{ side.name }}</span><span class="tile num" :class="side.us ? 'tile-us' : ''">{{ side.goals }}</span>
          </template>
        </div>
        <p v-if="m && (m.match.scorers || (report && block.reportLabel))" class="mt-3 text-[15px] text-quiet">
          <template v-if="m.match.scorers">{{ `${block.scorersLabel}: ${m.match.scorers}. ` }}</template>
          <NuxtLink v-if="report && block.reportLabel" class="link text-ink" :to="articleHref(report)">{{ block.reportLabel }}</NuxtLink>
        </p>
      </div>
      <div class="rounded-3xl bg-tint p-5 lg:p-6">
        <p class="eyebrow">{{ block.formLabel }}</p>
        <p class="mt-4 flex gap-1.5" :aria-label="formLabel"><span v-for="(o, i) in last.form" :key="i" class="res" :class="`res-${o}`" aria-hidden="true">{{ o }}</span></p>
        <p v-if="block.formNote" class="mt-4 text-[15px] leading-snug text-quiet">{{ tidyText(block.formNote) }}</p>
      </div>
      <div class="rounded-3xl bg-tint p-5 lg:p-6">
        <p class="eyebrow">{{ block.standingLabel }}</p>
        <template v-if="last.ours">
          <p class="mt-2 flex items-baseline gap-2.5"><span class="num text-[56px] text-brand">{{ last.ours.place }}.</span><span class="font-display text-[17px] font-extrabold leading-tight">{{ words.placeWord }}<br>{{ words.afterRounds(last.ours.row.played) }}</span></p>
          <p class="mt-2 text-[15px] leading-snug text-quiet">{{ words.points(last.ours.row.points) }}, {{ words.scoreWord }} {{ last.ours.row.score }}.<template v-if="block.standingLinkLabel"> <NuxtLink class="link text-ink" :to="`/#${anchorOf('table')}`">{{ block.standingLinkLabel }}</NuxtLink></template></p>
        </template>
      </div>
    </div>
  </section>
</template>
