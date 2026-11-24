<script setup lang="ts">
// Patra's surroundings: the minutes as large serif numerals in a ruled grid, the walk first and
// the car smaller below it, and two photographs with their captions beside them.
import type { Place } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'surroundings'>; first?: boolean; anchor?: string; places: Place[] }>()
const w = useSiteWords().value.patra
const walk = computed(() => props.places.filter((p) => p.mode === 'walk'))
const car = computed(() => props.places.filter((p) => p.mode === 'car'))
const photos = computed(() => props.block.photos.filter((p) => p.image).slice(0, 2))
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-2">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3">{{ block.heading }}</component>
      </div>
      <p v-if="block.text" class="lead lg:col-span-5">{{ tidyText(block.text) }}</p>
    </div>

    <div class="mt-10 lg:mt-12 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div :class="photos.length ? 'lg:col-span-7' : 'lg:col-span-12'">
        <template v-if="walk.length">
          <h3 class="label font-sans! pb-3 border-b border-line">{{ w.walk }}</h3>
          <ul class="grid grid-cols-2 sm:grid-cols-3 gap-x-6">
            <li v-for="p in walk" :key="p.id" class="py-5 border-b border-line">
              <p class="serif text-[3rem] leading-none! text-brand num">{{ p.minutes }} <span class="font-sans font-light text-[0.92rem] text-quiet tracking-normal">{{ w.min }}</span></p>
              <p class="mt-1.5">{{ p.name }}</p>
            </li>
          </ul>
        </template>
        <template v-if="car.length">
          <h3 class="label font-sans! pb-3 border-b border-line" :class="walk.length ? 'mt-9' : ''">{{ w.car }}</h3>
          <ul class="grid grid-cols-2 sm:grid-cols-4 gap-x-6">
            <li v-for="p in car" :key="p.id" class="py-5 border-b border-line">
              <p class="serif text-[2.2rem] leading-none! num">{{ p.minutes }} <span class="font-sans font-light text-[0.92rem] text-quiet tracking-normal">{{ w.min }}</span></p>
              <p class="mt-1.5">{{ p.name }}</p>
            </li>
          </ul>
        </template>
        <p v-if="block.note" class="mt-6 text-[0.96rem] text-quiet">{{ tidyText(block.note) }}</p>
      </div>
      <div v-if="photos.length" class="lg:col-span-5 grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-6 content-start">
        <figure v-for="(p, i) in photos" :key="i">
          <div class="aspect-[4/3] lg:aspect-[2/1]"><CmsImage :media="p.image!" class="photo" sizes="(min-width: 1024px) 34rem, 50vw" /></div>
          <figcaption v-if="p.caption" class="cap">{{ p.caption }}</figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
