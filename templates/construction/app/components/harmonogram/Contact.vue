<script setup lang="ts">
// Harmonogram's contact: the office as ruled rows in mono on the left; the area on the right,
// each town as a bar as long as its distance from the seat, the laser closing the scale at the
// farthest one.
import type { Town } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; towns: Town[] }>()
const { settings, words, tel } = await useFirm()
const scale = computed(() => townsOnScale(props.towns, props.block.rangeKm))
// The address stands in the heading when the firm wrote it there; otherwise it is a row of its own.
const addressRow = computed(() => !!settings.value?.street && !props.block.officeHeading.includes(settings.value.street))
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-20 py-20 lg:py-28">
    <div class="grid gap-14 lg:grid-cols-12 lg:gap-8">
      <div class="lg:col-span-4">
        <p v-if="block.officeEyebrow" class="mono">{{ block.officeEyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[34px] font-extrabold leading-[1] tracking-[-.035em] text-text sm:text-[44px]" :class="block.officeEyebrow ? 'mt-3' : ''"><KitMarked :text="block.officeHeading" as="span" :attrs="{ class: 'text-brand' }" /></component>
        <dl class="mt-8 border-t border-line text-[15px]">
          <div v-if="addressRow" class="flex justify-between gap-6 border-b border-line py-3"><dt class="mono pt-0.5">{{ words.address }}</dt><dd class="text-right text-text">{{ settings?.street }}, {{ settings?.town }}</dd></div>
          <div v-for="(h, i) in settings?.hours ?? []" :key="i" class="flex justify-between gap-6 border-b border-line py-3"><dt class="mono pt-0.5">{{ h.days }}</dt><dd class="num text-text">{{ h.time }}</dd></div>
          <div v-if="tel && settings?.phone" class="flex justify-between gap-6 border-b border-line py-3"><dt class="mono pt-0.5">{{ words.phone }}</dt><dd><a :href="tel" class="num text-text hover:text-brand">{{ settings.phone }}</a></dd></div>
          <div v-if="settings?.email" class="flex justify-between gap-6 border-b border-line py-3"><dt class="mono pt-0.5">{{ words.email }}</dt><dd><a :href="`mailto:${settings.email}`" class="break-all text-text underline decoration-line underline-offset-4 hover:text-brand">{{ settings.email }}</a></dd></div>
        </dl>
        <p v-if="block.officeNote" class="mt-4 text-[15px] leading-relaxed text-quiet">{{ tidyText(block.officeNote) }}</p>
      </div>
      <div class="lg:col-span-7 lg:col-start-6">
        <p v-if="block.regionEyebrow" class="mono">{{ block.regionEyebrow }}</p>
        <h2 class="text-[34px] font-extrabold leading-[1] tracking-[-.035em] text-text sm:text-[44px]" :class="block.regionEyebrow ? 'mt-3' : ''"><KitMarked :text="block.regionHeading" as="span" :attrs="{ class: 'text-brand' }" /></h2>
        <p v-if="block.regionText" class="mt-4 max-w-[36em] leading-[1.6] text-quiet">{{ tidyText(block.regionText) }}</p>
        <div v-if="scale.placed.length" class="relative mt-8">
          <ul class="num border-t border-line text-[14px]" :aria-label="words.regionAria">
            <li v-for="p in scale.placed" :key="p.town.id" class="grid grid-cols-[150px_1fr_52px] items-center gap-3 border-b border-line py-2 sm:grid-cols-[190px_1fr_52px]" data-town>
              <span class="font-sans text-[15px] text-text" :class="p.town.seat ? 'font-bold' : ''">{{ p.town.name }}</span>
              <span class="relative h-[10px]"><span class="absolute inset-y-0 left-0" :class="p.town.seat ? 'w-[10px] bg-brand' : 'bg-text'" :style="p.town.seat ? undefined : { width: `${p.at * 100}%` }" /></span>
              <span class="text-right" :class="p.town.seat || p.at >= 1 ? 'text-brand' : 'text-quiet'">{{ p.town.seat ? p.town.note : words.kmAway(p.town.km) }}</span>
            </li>
          </ul>
          <span class="laser-v right-[64px] !bottom-[-12px] !top-[-12px]" aria-hidden="true" />
        </div>
        <p v-if="block.otherPlaces" class="mt-6 text-[15px] leading-relaxed text-quiet">{{ tidyText(block.otherPlaces) }}</p>
      </div>
    </div>
  </section>
</template>
