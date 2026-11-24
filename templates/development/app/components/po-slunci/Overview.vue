<script setup lang="ts">
// Po slunci's building at a glance: the heading with a legend of the four sides and when each
// gets the sun, and beside it the floor plan seen from above, street to the north and garden to
// the south, with the sun's path around it. A switch picks the floor; the flats are coloured by
// state and lead to the price list. Everything on the plan comes from the flats.
import type { Flat, Floor } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'overview'>; first?: boolean; anchor?: string; flats: Flat[]; floors: Floor[] }>()
const words = useSiteWords()
const w = words.value.poSlunci
const { matches, jump, hovered } = useFlatBrowser()
const groups = computed(() => floorsOf(props.flats))
// The floor shown first: the highest one with the most flats (the recessed top floor has fewer).
const floor = ref(groups.value.reduce((best, g) => (g.flats.length > (best?.flats.length ?? 0) ? g : best), groups.value[0])?.floor ?? 0)
const current = computed(() => groups.value.find((g) => g.floor === floor.value) ?? groups.value[0])
const plan = computed(() => planOf(current.value?.flats ?? []))
const isTop = computed(() => current.value?.floor === groups.value[0]?.floor && groups.value.length > 1)
const sides = computed(() => sunGroups(props.flats))
const legend = computed(() => statesOf(props.flats))
const place = (cell: PlanCell) => ({ gridColumn: `${cell[0]} / ${cell[2]}`, gridRow: `${cell[1]} / ${cell[3]}` })
</script>

<template>
  <section :id="anchor" class="wrap sec scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10 items-start">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2">{{ block.heading }}</component>
        <p v-if="block.text" class="lead mt-5">{{ tidyText(block.text) }}</p>
        <ul v-if="sides.length" class="mt-8 flex flex-col gap-2.5">
          <li v-for="s in sides" :key="s.orientation" class="flex items-center gap-3 rounded-2xl bg-soft px-5 py-3.5">
            <PoSlunciSun :orientation="s.orientation" />
            <p><strong class="font-semibold">{{ words.orientationCap[s.orientation] }}</strong> · {{ words.sun[s.orientation] }} <span class="text-quiet whitespace-nowrap">{{ w.flatsOn(s.places) }}</span></p>
          </li>
        </ul>
      </div>

      <!-- the floor plan with the path of the sun -->
      <div class="lg:col-span-7 card bg-soft">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="seg" role="group" :aria-label="w.floors" data-floors>
            <button v-for="g in groups" :key="g.floor" type="button" class="tab" :aria-pressed="g.floor === floor" :data-floor="g.floor" @click="floor = g.floor">{{ words.floorNp(g.floor) }}</button>
          </div>
          <p class="text-[0.94rem] font-medium" aria-live="polite">{{ floorNote(floor, floors) }}</p>
        </div>
        <div class="relative mt-5 aspect-[100/92] sm:aspect-[100/80]">
          <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 80" preserveAspectRatio="none" fill="none" aria-hidden="true">
            <path d="M93 34A43 40 0 0 1 7 34" stroke="var(--brand)" stroke-opacity=".6" stroke-width="2.5" stroke-dasharray="1 9" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          </svg>
          <p class="absolute left-1/2 top-[1%] -translate-x-1/2 flex items-center gap-2 text-[0.84rem] font-medium text-quiet whitespace-nowrap"><span class="w-6 h-6 rounded-full bg-paper text-ink text-[0.74rem] font-bold flex items-center justify-center">{{ w.plan.street }}</span>{{ block.northLabel }}</p>
          <div class="absolute left-[15%] right-[15%] top-[11%] h-[54%]" data-plan>
            <div class="grid grid-cols-8 grid-rows-2 gap-1.5 h-full" :class="isTop ? 'p-[4%] rounded-[1.1rem] border-[1.5px] border-dashed' : ''" style="border-color:var(--dash)">
              <a
                v-for="f in current?.flats ?? []" :key="f.id" :href="`#byt-${f.slug}`" class="cell" :class="[`cell-${f.state}`, { 'is-off': !matches(f), 'is-on': hovered === f.slug }]" :style="place(plan.cells[f.id]!)"
                :data-unit="f.number" :aria-label="words.flatLabel(f.number, f.layout, areaText(f.area), words.states[f.state].toLowerCase())" @click.prevent="jump(f.slug)"
              ><b>{{ f.number }}</b><span>{{ f.layout }}<template v-if="f.state !== 'free'"> · {{ words.states[f.state].toLowerCase() }}</template></span></a>
              <div v-if="plan.core" class="core" :style="place(plan.core)" :title="w.plan.core"><UIcon name="i-lucide-arrow-up-down" class="size-4" aria-hidden="true" /></div>
            </div>
          </div>
          <p class="absolute left-[7%] top-[42.5%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-[0.8rem] font-semibold"><span class="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-sun" />{{ w.plan.evening }}</p>
          <p class="absolute left-1/2 top-[92.5%] -translate-x-1/2 -translate-y-1/2 text-[0.8rem] font-semibold whitespace-nowrap"><span class="block w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-sun" /><span class="absolute left-full top-1/2 -translate-y-1/2 ml-1.5 px-1.5 bg-soft rounded">{{ w.plan.noon }}</span></p>
          <p class="absolute left-[93%] top-[42.5%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-[0.8rem] font-semibold"><span class="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-sun" />{{ w.plan.morning }}</p>
          <p class="absolute left-1/2 top-[73%] -translate-x-1/2 text-[0.84rem] font-medium text-quiet whitespace-nowrap">{{ block.southLabel }}</p>
        </div>
        <ul class="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem] font-medium">
          <li v-for="s in legend" :key="s" class="flex items-center gap-2"><span class="w-4 h-4 rounded-[5px]" :class="s === 'free' ? 'bg-sun' : ''" :style="s === 'reserved' ? 'background:repeating-linear-gradient(135deg, var(--sun) 0 3px, var(--paper) 3px 6px)' : s === 'sold' ? 'background:color-mix(in srgb, var(--ink) 14%, transparent)' : undefined" />{{ words.states[s].toLowerCase() }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>
