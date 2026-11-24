<script setup lang="ts">
// Celý rok's tips for trips: a list led by large distances, each with the twelve months it
// suits as a small year, filtered by the season the guest chooses; a tall photograph beside it.
import type { Trip } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'trips'>; first?: boolean; anchor?: string; trips: Trip[] }>()
const { words } = await useStay()
const season = ref<SeasonKey | ''>('')
const shown = (trip: Trip) => !season.value || trip[season.value]
const photo = computed(() => props.block.photos.find((p) => p.image) ?? null)
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-8 items-end">
      <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-6"><KitMarked :text="block.heading" plain /></component>
      <div class="lg:col-span-6 flex flex-wrap gap-2 lg:justify-end" role="group" :aria-label="words.chooseSeason">
        <button type="button" class="fchip" :aria-pressed="season === ''" @click="season = ''">{{ words.allYear }}</button>
        <button v-for="k in SEASON_KEYS" :key="k" type="button" class="fchip" :data-season="k" :aria-pressed="season === k" @click="season = k">{{ words.seasonNames[k].charAt(0).toUpperCase() + words.seasonNames[k].slice(1) }}</button>
      </div>
    </div>

    <div class="mt-10 md:mt-14 grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div v-if="photo" class="lg:col-span-5">
        <div class="ph aspect-[3/2] lg:aspect-[4/5]"><CmsImage :media="photo.image!" sizes="(min-width: 1024px) 34rem, 100vw" /></div>
        <p v-if="photo.caption" class="mt-3 text-sm text-quiet">{{ tidyText(photo.caption) }}</p>
      </div>
      <ul :class="photo ? 'lg:col-span-7' : 'lg:col-span-12'">
        <li v-for="t in trips" :key="t.id" class="trip rule py-5 grid grid-cols-[5.5rem_1fr] md:grid-cols-[8rem_1fr_auto] gap-x-5 gap-y-2" :hidden="!shown(t)" :data-trip="t.id">
          <p class="font-display text-3xl md:text-4xl leading-none text-brand num">{{ t.distance }}</p>
          <div><h3 class="font-sans font-semibold text-xl tracking-normal">{{ t.name }}</h3><p v-if="t.text" class="mt-1 text-quiet max-w-[48ch]">{{ tidyText(t.text) }}</p></div>
          <div class="col-start-2 md:col-start-3">
            <span class="mini" role="img" :aria-label="tripMonthsText(words, t)"><i v-for="(on, i) in tripMonths(t)" :key="i" :class="{ on }" /></span>
            <span class="block mt-1.5 text-sm text-quiet">{{ tripMonthsText(words, t) }}</span>
          </div>
        </li>
        <li class="rule" />
      </ul>
    </div>
  </section>
</template>
