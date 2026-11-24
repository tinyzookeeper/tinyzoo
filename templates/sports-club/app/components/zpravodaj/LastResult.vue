<script setup lang="ts">
// Zpravodaj's strip under the opening: three ruled columns, the last result, the last five
// matches as small squares, and the place in the table.
import type { LastView } from '../../composables/useClub'

const props = defineProps<{ block: BlockOf<'lastResult'>; first?: boolean; last: LastView }>()
const { words } = await useClub()
const m = computed(() => props.last.match)
const report = computed(() => m.value?.match.report ?? null)
const formLabel = computed(() => props.last.form.map((o) => words.value.outcome[o][0]!.toUpperCase() + words.value.outcome[o].slice(1)).join(', '))
</script>

<template>
  <section class="wrap mt-12 lg:mt-16" :data-last-result="m?.score ?? ''">
    <div class="grid border-y border-ink md:grid-cols-3">
      <div class="py-6 md:pr-8">
        <p class="label">{{ block.resultLabel }}<template v-if="m"> · {{ weekday(m.at) }} {{ dayMonth(m.at) }}</template></p>
        <div v-if="m" class="mt-3 flex items-center gap-4">
          <p class="font-display text-[44px] font-extrabold leading-none text-ink">{{ m.score }}</p>
          <p class="leading-snug"><span class="block" :class="m.home.us ? 'font-semibold text-ink' : ''">{{ m.home.name }}</span><span class="block" :class="m.away.us ? 'font-semibold text-ink' : ''">{{ m.away.name }}</span></p>
        </div>
        <p v-if="m && (m.match.scorers || (report && block.reportLabel))" class="mt-3 text-sm">
          <template v-if="m.match.scorers">{{ block.scorersLabel }}: {{ m.match.scorers }}. </template>
          <NuxtLink v-if="report && block.reportLabel" class="link !font-medium" :to="articleHref(report)">{{ block.reportLabel }}</NuxtLink>
        </p>
      </div>
      <div class="border-t border-line py-6 md:border-l md:border-t-0 md:px-8">
        <p class="label">{{ block.formLabel }}</p>
        <div class="mt-4 flex items-center gap-1.5" :aria-label="formLabel">
          <span v-for="(o, i) in last.form" :key="i" class="res !h-8 !w-8 !text-sm" :class="`res-${o}`">{{ o }}</span>
        </div>
        <p v-if="block.formNote" class="mt-4 text-sm">{{ tidyText(block.formNote) }}</p>
      </div>
      <div class="border-t border-line py-6 md:border-l md:border-t-0 md:pl-8">
        <p class="label">{{ block.standingLabel }}</p>
        <div v-if="last.ours" class="mt-3 flex items-center gap-4">
          <p class="font-display text-[44px] font-extrabold leading-none text-ink">{{ last.ours.place }}.</p>
          <p class="leading-snug"><span class="block font-semibold text-ink">{{ words.pointsOf(last.ours.row.points, last.ours.row.played) }}</span><span class="block">{{ words.scoreWord }} {{ last.ours.row.score }}</span></p>
        </div>
        <p v-if="block.standingNote || block.standingLinkLabel" class="mt-3 text-sm">
          <template v-if="block.standingNote">{{ `${block.standingNote} ` }}</template>
          <NuxtLink v-if="block.standingLinkLabel" class="link !font-medium" :to="`/#${anchorOf('table')}`">{{ block.standingLinkLabel }}</NuxtLink>
        </p>
      </div>
    </div>
  </section>
</template>
