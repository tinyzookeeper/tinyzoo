<script setup lang="ts">
// Celý rok's year: one ribbon of twelve months coloured by season, with today marked, and
// under it each season with its dates, the price from and the shortest stay.
import type { Season } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'year'>; first?: boolean; anchor?: string; rows: Array<{ season: Season; from: number | null }> }>()
const { words } = await useStay()
const segments = computed(() => ribbonSegments(props.rows.map((r) => r.season)))
const spoken = computed(() => words.value.yearRibbon(props.rows.map((r) => seasonSpoken(r.season)).join(', ')))
// Today is only known in the browser: the marker appears once the page is drawn.
const today = ref<{ at: number; text: string } | null>(null)
onMounted(() => {
  const now = new Date()
  today.value = { at: todayPercent(now), text: words.value.todayAt(now.getDate(), now.getMonth() + 1) }
})
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6">
      <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-6"><KitMarked :text="block.heading" plain /></component>
      <div v-if="block.text" class="lg:col-span-5 lg:col-start-8 text-quiet space-y-4">
        <p v-for="(p, i) in paragraphs(block.text)" :key="i">{{ tidyText(p) }}</p>
      </div>
    </div>

    <div class="mt-12 md:mt-16">
      <div class="grid grid-cols-12 text-quiet label !tracking-[0.08em]" aria-hidden="true">
        <span v-for="m in words.months" :key="m"><span class="md:hidden">{{ m.charAt(0).toUpperCase() }}</span><span class="hidden md:inline">{{ m }}</span></span>
      </div>
      <div class="relative mt-2">
        <div class="year-bar" role="img" :aria-label="spoken">
          <div v-for="(s, i) in segments" :key="i" class="seg" :class="`seg-${s.tone}`" :style="{ flex: `${s.days} 1 0` }"><span v-if="s.label" class="hidden md:inline">{{ s.label }}</span></div>
        </div>
        <div v-if="today" class="absolute -top-1 -bottom-1 w-0.5 bg-text" :style="{ left: `${today.at}%` }" aria-hidden="true" />
      </div>
      <p class="mt-2 text-sm text-quiet relative h-6" aria-hidden="true"><span v-if="today" class="absolute -translate-x-1/2 whitespace-nowrap text-text font-semibold" :style="{ left: `${Math.min(94, Math.max(6, today.at))}%` }">{{ today.text }}</span></p>

      <div class="mt-8 grid md:grid-cols-3 gap-x-10">
        <div v-for="r in rows" :key="r.season.id" class="rule py-5 flex gap-4">
          <span class="sw mt-2" :class="`sw-${r.season.tone}`" />
          <div>
            <h3 class="font-sans font-semibold text-lg tracking-normal">{{ r.season.name }}</h3>
            <p class="text-quiet num">{{ seasonDates(r.season) }}</p>
            <p v-if="r.from != null" class="mt-2">{{ words.from }} <strong class="font-display font-normal text-2xl num">{{ formatPrice(r.from) }}&nbsp;Kč</strong> {{ words.perNight }}<template v-if="r.season.minNights"> · {{ words.atLeast(r.season.minNights) }}</template></p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
