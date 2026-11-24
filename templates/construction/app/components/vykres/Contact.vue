<script setup lang="ts">
// Výkres's contact: the office as a ruled list on the left, the area on the right, and under
// them the towns on a distance axis from the seat of the firm (a ruled list on a phone).
import type { Town } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; towns: Town[] }>()
const { settings, words, tel, postalTown } = await useFirm()
const scale = computed(() => townsOnScale(props.towns, props.block.rangeKm))
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 pb-20 pt-20 lg:pb-28 lg:pt-28">
    <div class="grid gap-12 lg:grid-cols-12 lg:gap-8">
      <div class="lg:col-span-4">
        <p v-if="block.officeEyebrow" class="lab mb-3">{{ block.officeEyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] font-light leading-tight tracking-[-.02em] text-ink sm:text-[42px]"><KitMarked :text="block.officeHeading" as="span" /></component>
        <dl class="mt-7 border-t border-ink text-[15px]">
          <div v-if="settings?.street && !block.officeHeading.includes(settings.street)" class="grid grid-cols-[110px_1fr] gap-4 border-b border-hair py-3"><dt class="lab pt-0.5">{{ words.address }}</dt><dd class="text-ink">{{ settings.street }}<br>{{ postalTown }}</dd></div>
          <div v-if="settings?.hours.length" class="grid grid-cols-[110px_1fr] gap-4 border-b border-hair py-3"><dt class="lab pt-0.5">{{ words.openHours }}</dt><dd class="text-ink"><template v-for="(h, i) in settings.hours" :key="i"><br v-if="i">{{ h.days.toLowerCase() }} {{ h.time }}</template></dd></div>
          <div v-if="tel && settings?.phone" class="grid grid-cols-[110px_1fr] gap-4 border-b border-hair py-3"><dt class="lab pt-0.5">{{ words.phone }}</dt><dd><a :href="tel" class="text-ink underline decoration-1 underline-offset-4 hover:text-brand">{{ settings.phone }}</a></dd></div>
          <div v-if="settings?.email" class="grid grid-cols-[110px_1fr] gap-4 border-b border-ink py-3"><dt class="lab pt-0.5">{{ words.email }}</dt><dd><a :href="`mailto:${settings.email}`" class="break-all text-ink underline decoration-1 underline-offset-4 hover:text-brand">{{ settings.email }}</a></dd></div>
        </dl>
        <p v-if="block.officeNote" class="mt-4 text-[15px] leading-relaxed text-quiet">{{ tidyText(block.officeNote) }}</p>
      </div>
      <div class="lg:col-span-7 lg:col-start-6">
        <p v-if="block.regionEyebrow" class="lab mb-3">{{ block.regionEyebrow }}</p>
        <h2 class="font-display text-[32px] font-light leading-tight tracking-[-.02em] text-ink sm:text-[42px]"><KitMarked :text="block.regionHeading" as="span" /></h2>
        <p v-if="block.regionText" class="mt-6 max-w-[38em] leading-[1.65]">{{ tidyText(block.regionText) }}</p>
        <p v-if="block.otherPlaces" class="mt-4 max-w-[38em] text-[15px] leading-relaxed text-quiet">{{ tidyText(block.otherPlaces) }}</p>
      </div>
    </div>
    <ol v-if="scale.placed.length" class="axis mt-10 border-t border-ink text-[15px] lg:mt-14 lg:border-t-0" :aria-label="words.regionAria" :style="{ '--end': scale.end }">
      <li v-for="(p, i) in scale.placed" :key="p.town.id" :class="{ low: i % 2 === 1, end: i === scale.placed.length - 1 && p.at >= 1 }" :style="{ '--km': p.town.km }" data-town>
        <span :class="p.town.seat ? 'font-medium text-ink' : 'text-ink'">{{ p.town.name }}</span>
        <span class="font-data text-quiet">{{ p.town.seat ? p.town.note : words.kmAway(p.town.km) }}</span>
      </li>
    </ol>
  </section>
</template>
