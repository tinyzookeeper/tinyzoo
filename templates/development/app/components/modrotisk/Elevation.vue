<script setup lang="ts">
// The building as an elevation: one row per floor, one bay per flat as wide as its floor area,
// the level of each floor in the margin. Free flats are lit white, reserved ones hatched and
// sold ones left empty; a flat the filter hides is dimmed. A click on a bay finds the flat in the
// price list. Drawn entirely from the flats (their floor, area, state and outdoor space), except
// the two trees and the hatched ground, which are decoration.
import type { Flat, Floor } from '~/lib/cms-content'

const props = defineProps<{ flats: Flat[]; floors: Floor[] }>()
const { settings } = await useSite()
const words = useSiteWords()
const { matches, jump, hovered } = useFlatBrowser()
const groups = computed(() => floorsOf(props.flats))
const top = computed(() => groups.value[0]?.floor)
const under = computed(() => groups.value[1]?.floor)
// A rail under the windows of the floors that have balconies.
const hasRail = (flats: Flat[]) => flats.some((f) => f.outdoorKind === 'balcony' || f.outdoorKind === 'loggia')
const legend = computed(() => statesOf(props.flats))
</script>

<template>
  <div>
    <div class="relative lg:px-[9%]">
      <svg class="hidden lg:block absolute left-0 bottom-[9px] w-[8%] text-quiet" viewBox="0 0 80 150" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><circle cx="40" cy="52" r="36" /><path d="M40 150V60M40 96l-15-16M40 84l13-13" /></svg>
      <svg class="hidden lg:block absolute right-0 bottom-[9px] w-[6.5%] text-quiet" viewBox="0 0 80 150" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><circle cx="40" cy="62" r="34" /><path d="M40 150V70M40 104l14-15" /></svg>
      <div class="grid grid-cols-[3.4rem_minmax(0,1fr)] md:grid-cols-[5rem_minmax(0,1fr)]" :aria-label="words.modrotisk.elevationLabel" data-elevation>
        <template v-for="g in groups" :key="g.floor">
          <div class="lvl flex items-end justify-end pr-3 pb-0.5 border-b border-line">{{ levelOf(g.floor, floors) }}</div>
          <div
            class="flex h-[4.6rem] md:h-[6.4rem] border border-ink"
            :class="[g.floor === top && groups.length > 1 ? 'mx-[9%]' : '', hasRail(g.flats) ? 'rail' : '', g.floor !== top ? 'border-t-0' : '', g.floor === under && groups.length > 2 ? 'relative before:absolute before:inset-x-0 before:-top-px before:border-t before:border-ink' : '']"
          >
            <a
              v-for="f in g.flats" :key="f.id" :href="`#byt-${f.slug}`" class="bay" :class="[`bay-${f.state}`, { 'is-off': !matches(f), 'is-on': hovered === f.slug }]" :style="{ flex: `${toNumber(f.area)} 1 0` }"
              :data-unit="f.number" :aria-label="words.flatLabel(f.number, f.layout, areaText(f.area), words.states[f.state].toLowerCase())" @click.prevent="jump(f.slug)"
            ><span class="bay-n">{{ f.number }}</span><span class="bay-d">{{ f.layout }}</span><span class="bay-a">{{ areaText(f.area) }}</span></a>
          </div>
        </template>
      </div>
      <div class="h-[9px] -mx-0 lg:-mx-[11%] border-t border-ink" style="background-image: var(--hatch); opacity:.55" />
    </div>
    <div class="mt-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-2">
      <p class="label">{{ settings?.elevationCaption }}</p>
      <ul class="flex flex-wrap gap-x-6 gap-y-1 text-[0.94rem]">
        <li v-for="s in legend" :key="s"><span class="st" :class="`st-${s}`" />{{ words.states[s].toLowerCase() }}</li>
      </ul>
    </div>
  </div>
</template>
