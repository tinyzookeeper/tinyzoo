<script setup lang="ts">
// Katastr's "where we work": the drawn map of the district on the left (the rivers, two rings
// of distance, the towns lit where something is on offer), and on the right two ruled lists
// of places with the number of properties in each, the town and the surroundings.
import type { Area } from '../../lib/cms-content'

type Place = Area & { count: number }
const props = defineProps<{ block: BlockOf<'areas'>; first?: boolean; anchor?: string; places: Place[] }>()
const { settings, words } = await useOffice()
const w = words.value.katastr
const inTown = computed(() => props.places.filter((p) => p.group === 'town'))
const around = computed(() => props.places.filter((p) => p.group === 'surroundings'))
</script>

<template>
  <section :id="anchor" class="wrap py-20 md:py-28 grid lg:grid-cols-12 gap-x-12 gap-y-10 items-center">
    <div class="lg:col-span-6 lg:order-2">
      <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[2.1rem] md:text-[2.75rem] leading-[1.1]"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="mt-5 max-w-[34rem]">{{ tidyText(block.text) }}</p>
      <div class="mt-8 grid sm:grid-cols-2 gap-x-10 text-[0.97rem]">
        <div v-if="inTown.length">
          <p class="label text-quiet pb-2 border-b border-ink">{{ settings?.town || w.town }}</p>
          <ul>
            <li v-for="p in inTown" :key="p.id" class="flex justify-between py-2 border-b border-line"><span>{{ tidyText(p.name) }}</span><span class="num text-quiet">{{ p.onRequest ? w.onRequest : p.count }}</span></li>
          </ul>
        </div>
        <div v-if="around.length" :class="inTown.length ? 'mt-8 sm:mt-0' : ''">
          <p class="label text-quiet pb-2 border-b border-ink">{{ w.around }}</p>
          <ul>
            <li v-for="p in around" :key="p.id" class="flex justify-between py-2 border-b border-line"><span>{{ tidyText(p.name) }}</span><span class="num text-quiet">{{ p.onRequest ? w.onRequest : p.count }}</span></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="lg:col-span-6 lg:order-1">
      <KatastrMapDrawing :towns="block.towns" />
    </div>
  </section>
</template>
