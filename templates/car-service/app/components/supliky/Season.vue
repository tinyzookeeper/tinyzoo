<script setup lang="ts">
// Šuplíky's seasonal notice: prices by wheel size, drawn as wheels that grow with the size, the
// heading and a button beside them (the photograph of the balancing machine on a tablet and up).
import type { SeasonalOffer } from '../../lib/cms-content'

defineProps<{ offer: SeasonalOffer; first?: boolean; anchor?: string }>()
const { words } = await useGarage()
// (full class names, so the stylesheet finds them: the wheels grow from the first price to the fourth)
const wheel = ['w-[124px] h-[124px] sm:w-[122px] sm:h-[122px]', 'w-[134px] h-[134px] sm:w-[142px] sm:h-[142px]', 'w-[144px] h-[144px] sm:w-[162px] sm:h-[162px]', 'w-[154px] h-[154px] sm:w-[182px] sm:h-[182px]']
const figure = ['text-[23px]', 'text-[25px]', 'text-[27px]', 'text-[29px]']
</script>

<template>
  <section data-season class="wrap pb-14 lg:pb-20 pt-6" :aria-labelledby="anchor">
    <div class="rounded-[32px] bg-tint grid lg:grid-cols-12 gap-x-8 gap-y-8 p-5 sm:p-8 lg:p-10 items-center">
      <div class="lg:col-span-5 flex gap-5 sm:gap-6 items-start">
        <CmsImage v-if="offer.image" :media="offer.image" sizes="10rem" class="hidden sm:block flex-none w-[150px] aspect-square object-cover !object-[70%_60%] rounded-[24px]" />
        <div>
          <p class="kicker text-brand">{{ words.seasonUntil(shortDay(dayOf(offer.validTo!))) }}</p>
          <component :is="first ? 'h1' : 'h2'" :id="anchor" class="mt-2 text-[36px] sm:text-[44px]">{{ plainEmphasis(offer.title) }}</component>
          <p v-if="offer.text" class="mt-3 text-[16.5px] leading-[1.5]">{{ tidyText(offer.text) }}</p>
          <NuxtLink v-if="offer.buttonLabel" :to="siteHref(offer.buttonUrl)" class="btn btn-ink mt-5 !min-h-[48px] !text-[18px]">{{ offer.buttonLabel }}</NuxtLink>
        </div>
      </div>
      <ul class="lg:col-span-7 grid grid-cols-2 sm:flex sm:flex-wrap xl:flex-nowrap sm:justify-between sm:items-end gap-x-3 gap-y-6 text-center">
        <li v-for="(p, i) in offer.prices" :key="p.id" class="flex flex-col items-center justify-end gap-3">
          <span class="tyre" :class="wheel[Math.min(i, 3)]"><span class="num leading-none" :class="figure[Math.min(i, 3)]">{{ formatPrice(p.price) }}<span class="block text-[14px] font-sans font-medium mt-0.5">Kč</span></span></span>
          <span class="text-[15px] leading-tight"><b class="font-semibold block">{{ tidyText(p.label) }}</b>{{ p.note }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
