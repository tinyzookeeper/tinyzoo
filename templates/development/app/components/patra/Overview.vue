<script setup lang="ts">
// Patra's building at a glance: a soft panel with the heading and one small square for every
// flat (free filled, reserved hatched, sold outlined). A square leads to the flat in the price
// list. The squares are drawn from the flats; on a phone they make two rows.
import type { Flat, Floor } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'overview'>; first?: boolean; anchor?: string; flats: Flat[]; floors: Floor[] }>()
const words = useSiteWords()
const w = words.value.patra
const { jump } = useFlatBrowser()
const legend = computed(() => statesOf(props.flats))
</script>

<template>
  <section :id="anchor" class="wrap pt-14 lg:pt-20">
    <div class="rounded-[18px] bg-soft px-6 py-8 sm:px-10 lg:px-12 lg:py-10 grid lg:grid-cols-12 gap-x-12 gap-y-7 items-center">
      <div class="lg:col-span-5">
        <component :is="first ? 'h1' : 'h2'" class="text-[2.1rem] lg:text-[2.6rem]">{{ block.heading }}</component>
        <p v-if="block.text" class="mt-3 text-quiet max-w-[26rem]">{{ tidyText(block.text) }}</p>
      </div>
      <div class="lg:col-span-7">
        <ul class="squares grid gap-2 lg:gap-2.5" :style="{ '--n': flats.length, '--h': Math.ceil(flats.length / 2) }" :aria-label="w.squares">
          <li v-for="f in flats" :key="f.id">
            <a class="sq" :class="`sq-${f.state}`" :href="`#byt-${f.slug}`" :title="w.squareTitle(f.number, f.layout, words.states[f.state].toLowerCase())" :aria-label="words.flatLabel(f.number, f.layout, areaText(f.area), words.states[f.state].toLowerCase())" @click.prevent="jump(f.slug)"></a>
          </li>
        </ul>
        <ul class="mt-5 flex flex-wrap gap-x-7 gap-y-1 text-[0.92rem]">
          <li v-for="s in legend" :key="s" class="flex items-center gap-2"><span class="sq w-3.5! rounded-[4px]!" :class="`sq-${s}`" />{{ words.states[s].toLowerCase() }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>
