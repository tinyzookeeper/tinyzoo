<script setup lang="ts">
// Zrcadlo's opening: the heading and two buttons beside a photograph in an oval mirror, a small
// round mirror and a badge on it; the quick prices as one strip under them.
import type { Service } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; quick: Service[] }>()
const { words, days, range } = await useSalon()
const choice = useBookingChoice()
const today = useToday()
const now = useOpenNow(days, today)
// "Otevřeno pondělí až sobota" until the browser says which day it is, then today's hours.
const todayText = computed(() => (now.value ? words.value.zrcadlo.today(now.value) : range.value ? words.value.zrcadlo.week(...range.value) : ''))
</script>

<template>
  <section :id="anchor" class="wrap pt-6 md:pt-10 pb-14 md:pb-20">
    <div class="grid lg:grid-cols-12 gap-y-14 gap-x-10 items-center">
      <div class="lg:col-span-6">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[42px] leading-[1.06] sm:text-[56px] lg:text-[68px] lg:leading-[1.02] tracking-[-0.01em]">{{ tidyText(block.heading) }}</component>
        <p v-if="block.text" class="mt-6 max-w-[34rem] text-[18px] leading-[1.6]">{{ tidyText(block.text) }}</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn btn-brand">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
          <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="siteHref(block.secondaryUrl)" class="btn btn-line">{{ block.secondaryLabel }}</NuxtLink>
        </div>
        <p v-if="todayText" class="mt-7 flex items-center gap-3 text-[15px] text-ink">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_0_1px_var(--ink)]" />
          <span>{{ todayText }}</span>
        </p>
      </div>
      <div class="lg:col-span-6 relative flex justify-center lg:justify-end pt-3 pb-6 lg:pr-4">
        <div class="relative w-[78%] max-w-[440px]">
          <!-- (a wide photograph cropped to a tall oval: it has to be as wide as the crop needs) -->
          <div class="mirror aspect-[4/5]">
            <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 840px, 150vw" class="w-full h-full object-cover" />
          </div>
          <div v-if="block.image2" class="mirror absolute -left-[22%] bottom-[2%] w-[42%] aspect-square">
            <CmsImage :media="block.image2" sizes="(min-width: 1024px) 220px, 40vw" class="w-full h-full object-cover" />
          </div>
          <div v-if="block.badgeValue" class="absolute -right-[10%] top-[9%] w-[104px] h-[104px] sm:w-[124px] sm:h-[124px] rounded-full bg-accent text-ink flex flex-col items-center justify-center text-center shadow-[0_0_0_1px_var(--ink)]">
            <span class="text-[11px] font-semibold tracking-[.12em] uppercase">{{ block.badgeLabel }}</span>
            <span class="font-display text-[26px] sm:text-[32px] leading-none mt-1">{{ narrowPrice(block.badgeValue) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- The three prices people look for most -->
    <ul v-if="quick.length" class="mt-14 md:mt-20 grid sm:grid-cols-3 rounded-[28px] bg-surface overflow-hidden">
      <li v-for="(s, i) in quick" :key="s.id" :class="i ? 'border-t sm:border-t-0 sm:border-l border-line' : ''">
        <NuxtLink :to="`/#${anchorOf('booking')}`" class="price-row flex items-center justify-between gap-4 px-6 md:px-8 py-5 min-h-[84px]" @click="choice.service.value = s.name">
          <span>
            <span class="block font-semibold text-ink">{{ s.quickLabel || s.name }}</span>
            <span class="mt-1 flex items-center gap-2 text-sm text-quiet"><ZrcadloDials :minutes="s.minutes" />{{ s.minutes }} {{ words.min }}</span>
          </span>
          <span class="font-display text-[26px] text-ink whitespace-nowrap"><span v-if="s.priceFrom" class="font-sans text-sm text-quiet mr-1">{{ words.from }}</span>{{ kc(s.price, true) }}</span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
