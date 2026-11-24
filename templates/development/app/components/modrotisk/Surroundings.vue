<script setup lang="ts">
// Modrotisk's surroundings: the minutes to each place as a dimension line, drawn as long as the
// minutes (the longest fills the width), the walk and the car in two lists; two photographs in
// print frames beside them.
import type { Place } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'surroundings'>; first?: boolean; index?: number; anchor?: string; places: Place[] }>()
const w = useSiteWords().value.modrotisk
const longest = computed(() => Math.max(1, ...props.places.map((p) => p.minutes)))
const walk = computed(() => props.places.filter((p) => p.mode === 'walk'))
const car = computed(() => props.places.filter((p) => p.mode === 'car'))
const photos = computed(() => props.block.photos.filter((p) => p.image).slice(0, 2))
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-4">
    <p class="label sheet"><b>{{ sectionNo(index) }}</b> {{ block.eyebrow }}</p>
    <div class="mt-8 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div :class="photos.length ? 'lg:col-span-7' : 'lg:col-span-12'">
        <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] lg:text-[3.6rem]">{{ block.heading }}</component>
        <p v-if="block.text" class="mt-6 text-quiet max-w-[36rem]">{{ tidyText(block.text) }}</p>

        <template v-for="(group, g) in [{ title: w.walk, list: walk }, { title: w.car, list: car }]" :key="g">
          <template v-if="group.list.length">
            <h3 class="label text-ink! pb-3 border-b border-ink" :class="g === 0 ? 'mt-10' : 'mt-8'">{{ group.title }}</h3>
            <ul class="mt-2 text-[0.98rem]">
              <li v-for="p in group.list" :key="p.id" class="walk">
                <span>{{ p.name }}</span>
                <span class="flex items-center gap-3 min-w-0"><span class="dim flex-none" :style="{ width: `calc(${p.minutes} / ${longest} * (100% - 4.4rem))` }"><i /><i /></span><b class="num font-medium whitespace-nowrap">{{ p.minutes }} {{ w.min }}</b></span>
              </li>
            </ul>
          </template>
        </template>
        <p v-if="block.note" class="mt-5 text-[0.94rem] text-quiet">{{ tidyText(block.note) }}</p>
      </div>
      <div v-if="photos.length" class="lg:col-span-5 grid grid-cols-2 lg:grid-cols-1 gap-5 lg:gap-8 content-start">
        <figure v-for="(p, i) in photos" :key="i" :class="i === 1 ? 'lg:w-[78%] lg:ml-auto' : ''">
          <div class="frame aspect-[4/3] lg:aspect-[3/2]"><CmsImage :media="p.image!" sizes="(min-width: 1024px) 28rem, 50vw" /></div>
          <figcaption v-if="p.caption" class="cap"><span>{{ p.caption }}</span></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
