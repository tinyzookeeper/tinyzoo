<script setup lang="ts">
// Zdivo's contact: the office on the left, and the area on the right as bricks: the seat on a
// dark one, every town on a clay one with its distance, and a wide brick for the villages
// between them.
import type { Town } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; towns: Town[] }>()
const { settings, words, tel, postalTown } = await useFirm()
const scale = computed(() => townsOnScale(props.towns, props.block.rangeKm))
const layout = computed(() => bond(scale.value.placed.length, false))
// The wide brick takes what is left of the last desktop row (or a row of its own).
const SPAN: Record<number, string> = { 0: 'lg:col-span-24', 1: 'lg:col-span-6', 2: 'lg:col-span-12', 3: 'lg:col-span-18', 4: 'lg:col-span-24' }
const rest = computed(() => SPAN[layout.value.free] ?? 'lg:col-span-24')
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 py-20 lg:py-28">
    <div class="grid gap-12 lg:grid-cols-12 lg:gap-8">
      <div class="lg:col-span-4">
        <p v-if="block.officeEyebrow" class="eyebrow">{{ block.officeEyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2" :class="block.officeEyebrow ? 'mt-2' : ''"><KitMarked :text="block.officeHeading" as="span" /></component>
        <address class="mt-8 not-italic leading-[1.55]">
          <p v-if="settings?.street" class="font-display text-[26px] font-bold leading-[1.1] text-ink">{{ settings.street }}<br>{{ postalTown }}</p>
          <dl class="mt-6 space-y-2 text-[16px]">
            <div v-for="(h, i) in settings?.hours ?? []" :key="i" class="flex gap-4"><dt class="w-[88px] font-semibold text-ink">{{ h.days }}</dt><dd>{{ h.time }}</dd></div>
            <div v-if="tel && settings?.phone" class="flex gap-4"><dt class="w-[88px] font-semibold text-ink">{{ words.phone }}</dt><dd><a :href="tel" class="font-semibold text-brand underline-offset-4 hover:underline">{{ settings.phone }}</a></dd></div>
            <div v-if="settings?.email" class="flex gap-4"><dt class="w-[88px] flex-none font-semibold text-ink">{{ words.email }}</dt><dd class="min-w-0"><a :href="`mailto:${settings.email}`" class="break-all font-semibold text-brand underline-offset-4 hover:underline">{{ settings.email }}</a></dd></div>
          </dl>
        </address>
        <p v-if="block.officeNote" class="mt-6 text-[15px] leading-[1.5] text-quiet">{{ tidyText(block.officeNote) }}</p>
      </div>
      <div class="lg:col-span-8">
        <p v-if="block.regionEyebrow" class="eyebrow">{{ block.regionEyebrow }}</p>
        <h2 class="h2" :class="block.regionEyebrow ? 'mt-2' : ''"><KitMarked :text="block.regionHeading" as="span" /></h2>
        <p v-if="block.regionText" class="mt-5 max-w-[34em] leading-[1.5]">{{ tidyText(block.regionText) }}</p>
        <ul v-if="scale.placed.length" class="wall mt-8" :aria-label="words.regionAria">
          <template v-for="(cell, i) in layout.cells" :key="i">
            <li v-if="cell.kind === 'item'" class="brick col-span-2 lg:col-span-6" :class="scale.placed[cell.index]!.town.seat ? 'bg-ink text-plaster' : brickTone(cell.index - 1)" data-town>
              <b class="!text-[26px] lg:!text-[30px]">{{ scale.placed[cell.index]!.town.shortName || scale.placed[cell.index]!.town.name }}</b><span>{{ scale.placed[cell.index]!.town.seat ? scale.placed[cell.index]!.town.note : words.kmAway(scale.placed[cell.index]!.town.km) }}</span>
            </li>
            <li v-else-if="cell.kind === 'mb'" class="brick t3 col-span-1 lg:hidden" aria-hidden="true" />
            <li v-else class="brick t3 hidden lg:col-span-3 lg:flex" aria-hidden="true" />
          </template>
          <li v-if="block.otherPlaces" class="brick t3 col-span-4 !min-h-0 !py-4" :class="rest"><span class="!mt-0 !text-[15px] !leading-[1.45]">{{ tidyText(block.otherPlaces) }}</span></li>
        </ul>
      </div>
    </div>
  </section>
</template>
