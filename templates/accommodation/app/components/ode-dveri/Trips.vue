<script setup lang="ts">
// Ode dveří's tips for trips: up to three photographs in a row, then a list of two columns led
// by distances, each with its seasons as pills; filtered by the season the guest chooses.
import type { Trip } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'trips'>; first?: boolean; anchor?: string; trips: Trip[] }>()
const { words } = await useStay()
const season = ref<SeasonKey | ''>('')
const shown = (trip: Trip) => !season.value || trip[season.value]
const photos = computed(() => props.block.photos.filter((p) => !!p.image))
// How the photographs share the row, by how many there are.
const CELLS: Record<number, string[]> = {
  1: ['col-span-2 lg:col-span-12 aspect-[3/2] lg:aspect-auto lg:h-[27rem]'],
  2: ['col-span-2 lg:col-span-7 aspect-[3/2] lg:aspect-auto lg:h-[27rem]', 'col-span-2 lg:col-span-5 aspect-[3/2] lg:aspect-auto lg:h-[27rem]'],
  3: ['col-span-2 lg:col-span-6 aspect-[3/2] lg:aspect-auto lg:h-[27rem]', 'lg:col-span-3 aspect-[4/5] lg:aspect-auto lg:h-[27rem]', 'lg:col-span-3 aspect-[4/5] lg:aspect-auto lg:h-[27rem]'],
}
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-6 items-end">
      <div class="lg:col-span-6">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
      </div>
      <div class="lg:col-span-6 flex flex-wrap gap-2 lg:justify-end" role="group" :aria-label="words.chooseSeason">
        <button type="button" class="fchip" :aria-pressed="season === ''" @click="season = ''">{{ words.allYear }}</button>
        <button v-for="k in SEASON_KEYS" :key="k" type="button" class="fchip" :data-season="k" :aria-pressed="season === k" @click="season = k">{{ words.seasonNames[k].charAt(0).toUpperCase() + words.seasonNames[k].slice(1) }}</button>
      </div>
    </div>

    <div v-if="photos.length" class="mt-8 md:mt-12 grid grid-cols-2 lg:grid-cols-12 gap-3 md:gap-5">
      <div v-for="(p, i) in photos.slice(0, 3)" :key="p.id" class="ph" :class="CELLS[Math.min(3, photos.length)]![i]"><CmsImage :media="p.image!" :sizes="i === 0 && photos.length > 2 ? '(min-width: 1024px) 40rem, 100vw' : '(min-width: 1024px) 28rem, 50vw'" /></div>
    </div>

    <ul class="mt-6 md:mt-10 grid md:grid-cols-2 gap-x-12">
      <li v-for="t in trips" :key="t.id" class="trip rule py-6 grid grid-cols-[5.5rem_1fr] gap-x-4" :hidden="!shown(t)" :data-trip="t.id">
        <p class="text-[1.45rem] font-semibold tracking-[-0.02em] text-brand leading-tight num">{{ t.distance }}</p>
        <div>
          <h3 class="text-xl tracking-[-0.015em]">{{ t.name }}</h3>
          <p v-if="t.text" class="mt-1.5 text-quiet">{{ tidyText(t.text) }}</p>
          <p class="mt-3 flex flex-wrap gap-1.5"><span v-for="pill in tripPills(words, t)" :key="pill" class="pill">{{ pill }}</span></p>
        </div>
      </li>
    </ul>
  </section>
</template>
