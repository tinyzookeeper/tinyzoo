<script setup lang="ts">
// Výloha's opening: the shop window. The salon seen through tinted glass, a line of lettering
// painted in an arch, the heading and a few words, and below it the sill: the hours on the door,
// the price list and booking, the address.
import type { Service } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; quick: Service[] }>()
const { settings, words, days, range, townName } = await useSalon()
const today = useToday()
const now = useOpenNow(days, today)
// "pondělí až sobota" until the browser says which day it is, then today's hours.
const todayText = computed(() => (now.value ? words.value.vyloha.today(now.value) : range.value ? words.value.vyloha.week(...range.value) : ''))
const address = computed(() => [settings.value?.address, townName.value].filter(Boolean).join(', '))
</script>

<template>
  <section :id="anchor" class="wrap pt-6 md:pt-8">
    <div class="frame">
      <div class="relative overflow-hidden min-h-[540px] sm:min-h-[560px] lg:min-h-[600px] flex">
        <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1280px) 1160px, 100vw" class="absolute inset-0 w-full h-full object-cover" />
        <div class="absolute inset-0" style="background: radial-gradient(ellipse 75% 85% at 50% 50%, color-mix(in srgb, var(--glass) 84%, transparent) 0%, color-mix(in srgb, var(--glass) 74%, transparent) 55%, color-mix(in srgb, var(--glass) 38%, transparent) 100%)" />
        <div class="relative w-full flex flex-col items-center justify-center text-center px-5 py-6">
          <svg v-if="block.arc" viewBox="0 0 600 104" class="w-full max-w-[560px] overflow-visible" aria-hidden="true">
            <path id="vyloha-arc" d="M 20 104 Q 300 -28 580 104" fill="none" />
            <text class="gilt" fill="currentColor" style="font-family:var(--font-display);font-size:27px;letter-spacing:7px"><textPath href="#vyloha-arc" startOffset="50%" text-anchor="middle">{{ block.arc }}</textPath></text>
          </svg>
          <component
            :is="first ? 'h1' : 'h2'" class="lettering -mt-1 sm:-mt-3"
            :class="byLength(block.heading, [[16, 'text-[60px] sm:text-[96px] lg:text-[124px] leading-[1]']], 'max-w-[18em] text-[36px] sm:text-[52px] lg:text-[68px] leading-[1.05]')"
          >{{ tidyText(block.heading) }}</component>
          <p v-if="block.eyebrow" class="mt-5 flex items-center gap-4 caps text-brass !text-[12px] sm:!text-[14px]"><span class="dia" />{{ block.eyebrow }}<span class="dia" /></p>
          <p v-if="block.text" class="mt-5 max-w-[36rem] text-cream text-[17px] sm:text-[19px] leading-[1.5]">{{ tidyText(block.text) }}</p>
        </div>
      </div>
    </div>
    <!-- the sill: opening hours on the door, price list, booking, the address -->
    <div class="mt-5 grid lg:grid-cols-[1fr_auto_1fr] items-center gap-5 whitespace-nowrap">
      <p v-if="todayText" class="flex items-center justify-center lg:justify-start gap-3 order-2 lg:order-1"><span class="plate inline-flex items-center px-4 min-h-9 caps !text-[12px] text-glass" style="--pr:6px">{{ words.vyloha.openWord(now) }}</span><span class="text-cream">{{ todayText }}</span></p>
      <div class="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 order-1 lg:order-2">
        <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="siteHref(block.secondaryUrl)" class="panel btn btn-line">{{ block.secondaryLabel }}</NuxtLink>
        <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="plate btn btn-cream">{{ block.primaryLabel }}</NuxtLink>
      </div>
      <p v-if="address" class="text-center lg:text-right order-3"><NuxtLink :to="`/#${anchorOf('visit')}`" class="inline-flex items-center gap-3 min-h-11 font-display text-[22px] tracking-[.04em] text-cream hover:text-brass"><UIcon name="i-lucide-map-pin" class="text-brass text-lg" aria-hidden="true" />{{ address }}</NuxtLink></p>
    </div>
  </section>
</template>
