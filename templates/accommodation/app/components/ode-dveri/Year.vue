<script setup lang="ts">
// The year in Ode dveří's own terms (its design has no such section): the seasons as soft
// cards, each with its dates, the price from and the shortest stay, under a thin ribbon of the
// year in rounded pieces.
import type { Season } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'year'>; first?: boolean; anchor?: string; rows: Array<{ season: Season; from: number | null }> }>()
const { words } = await useStay()
const segments = computed(() => ribbonSegments(props.rows.map((r) => r.season)))
const spoken = computed(() => words.value.yearRibbon(props.rows.map((r) => seasonSpoken(r.season)).join(', ')))
// The tone of a piece of the ribbon: the brand colour for the main season, its soft tint for the quiet one.
const TONE: Record<string, string> = { main: 'bg-brand', off: 'bg-brand-soft', special: 'bg-ink', none: 'bg-soft' }
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
      <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-6"><KitMarked :text="block.heading" plain /></component>
      <div v-if="block.text" class="lg:col-span-5 lg:col-start-8 text-quiet space-y-3">
        <p v-for="(p, i) in paragraphs(block.text)" :key="i">{{ tidyText(p) }}</p>
      </div>
    </div>

    <div class="mt-8 md:mt-12">
      <div class="grid grid-cols-12 text-sm text-quiet" aria-hidden="true">
        <span v-for="m in words.months" :key="m"><span class="md:hidden">{{ m.charAt(0).toUpperCase() }}</span><span class="hidden md:inline">{{ m.charAt(0).toUpperCase() + m.slice(1, 3) }}</span></span>
      </div>
      <div class="mt-2 flex h-3 gap-0.5" role="img" :aria-label="spoken">
        <div v-for="(s, i) in segments" :key="i" class="first:rounded-l-full last:rounded-r-full" :class="TONE[s.tone]" :style="{ flex: `${s.days} 1 0` }" />
      </div>
      <div class="mt-8 grid md:grid-cols-3 gap-5">
        <div v-for="r in rows" :key="r.season.id" class="rounded-[24px] bg-soft p-6 md:p-8">
          <h3 class="text-xl tracking-[-0.015em] flex items-center gap-2.5"><span class="inline-block size-3 rounded-full" :class="TONE[r.season.tone]" />{{ r.season.name }}</h3>
          <p class="mt-1.5 text-quiet num">{{ seasonDates(r.season) }}</p>
          <p v-if="r.from != null" class="mt-4 num text-ink leading-tight"><span class="text-quiet">{{ words.from }}</span> <span class="text-[1.9rem] font-semibold tracking-[-0.02em]">{{ formatPrice(r.from) }}&nbsp;Kč</span> <span class="text-quiet">{{ words.perNight }}</span></p>
          <p v-if="r.season.minNights" class="mt-1 text-sm text-quiet">{{ words.atLeast(r.season.minNights) }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
