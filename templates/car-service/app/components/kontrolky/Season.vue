<script setup lang="ts">
// Kontrolky's seasonal notice: the frost warning, a snowflake and a figure beside the date, the
// heading and four prices under hairlines.
import type { SeasonalOffer } from '~/lib/cms-content'

defineProps<{ offer: SeasonalOffer; first?: boolean; anchor?: string }>()
const { words } = await useGarage()
</script>

<template>
  <section data-season class="wrap pb-16 lg:pb-24" :aria-labelledby="anchor">
    <div class="grid lg:grid-cols-12 gap-x-14 gap-y-9 items-center">
      <div class="lg:col-span-5">
        <p class="flex items-center gap-3 text-signal-amber">
          <LampIcon v-if="offer.chip" :path="FROST_PATH" class="text-[34px]" /><span v-if="offer.chip" class="dig font-semibold text-[22px]">{{ offer.chip }}</span><span class="text-[15px] text-quiet">{{ offer.chip ? `· ${words.seasonUntilAside(shortDay(dayOf(offer.validTo!)))}` : words.seasonUntil(shortDay(dayOf(offer.validTo!))) }}</span>
        </p>
        <component :is="first ? 'h1' : 'h2'" :id="anchor" class="mt-4 text-[36px] sm:text-[44px]">{{ plainEmphasis(offer.title) }}</component>
        <p v-if="offer.text" class="mt-4 text-quiet max-w-[30em]">{{ tidyText(offer.text) }}</p>
        <NuxtLink v-if="offer.buttonLabel" :to="siteHref(offer.buttonUrl)" class="btn btn-quiet mt-7">{{ offer.buttonLabel }}</NuxtLink>
      </div>
      <dl class="lg:col-span-7 grid grid-cols-2 gap-x-10 gap-y-8 lg:pl-6">
        <div v-for="p in offer.prices" :key="p.id" class="border-t border-line pt-5">
          <dt class="text-[16px]">{{ tidyText(p.label) }}</dt>
          <dd class="dig mt-1 text-[36px] font-semibold leading-none">{{ formatPrice(p.price) }} <span class="text-[19px]">Kč</span></dd>
          <dd v-if="p.note" class="mt-2 text-[15px] text-quiet">{{ p.note }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
