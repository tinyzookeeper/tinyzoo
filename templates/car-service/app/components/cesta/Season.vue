<script setup lang="ts">
// Cesta's seasonal notice: a tinted band with the heading, a sentence, four prices and a
// photograph of the balancing machine.
import type { SeasonalOffer } from '../../lib/cms-content'

defineProps<{ offer: SeasonalOffer; first?: boolean; anchor?: string }>()
const { words } = await useGarage()
</script>

<template>
  <section data-season class="wrap pb-16 lg:pb-24" :aria-labelledby="anchor">
    <div class="rounded-[28px] bg-tint overflow-hidden grid lg:grid-cols-12">
      <div class="p-7 sm:p-10 lg:p-12" :class="offer.image ? 'lg:col-span-8' : 'lg:col-span-12'">
        <p class="kicker">{{ words.seasonUntil(shortDay(dayOf(offer.validTo!))) }}</p>
        <component :is="first ? 'h1' : 'h2'" :id="anchor" class="mt-2 font-extrabold text-[34px] sm:text-[44px]">{{ plainEmphasis(offer.title) }}</component>
        <p v-if="offer.text" class="mt-4 text-[18px] max-w-[34em]">{{ tidyText(offer.text) }}</p>
        <dl class="mt-9 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-7">
          <div v-for="p in offer.prices" :key="p.id">
            <dt class="font-display font-bold text-[17px] leading-tight">{{ tidyText(p.label) }}</dt>
            <dd class="num mt-1.5 text-[30px] font-extrabold leading-none">{{ formatPrice(p.price) }}&nbsp;Kč</dd>
            <dd v-if="p.note" class="mt-2 text-[15px] text-quiet leading-snug">{{ p.note }}</dd>
          </div>
        </dl>
        <NuxtLink v-if="offer.buttonLabel" :to="siteHref(offer.buttonUrl)" class="btn btn-brand mt-10">{{ offer.buttonLabel }}</NuxtLink>
      </div>
      <CmsImage v-if="offer.image" :media="offer.image" sizes="(min-width: 1024px) 28rem, 100vw" class="lg:col-span-4 w-full h-full max-h-[320px] lg:max-h-none object-cover !object-[60%_60%]" />
    </div>
  </section>
</template>
