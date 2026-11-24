<script setup lang="ts">
// Šachovnice's opening: the brand colour from the header down to a floor of black and light
// tiles in perspective. The heading is huge and lowercase-wide; the photograph has a black
// border, and a black label on it says whether the salon is open today.
import type { Service } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; quick: Service[] }>()
const { words, days, range } = await useSalon()
const today = useToday()
const now = useOpenNow(days, today)
// "Po–so otevřeno" until the browser says which day it is, then today's hours.
const todayText = computed(() => (now.value ? words.value.sachovnice.today(now.value) : range.value ? words.value.sachovnice.week(...range.value) : ''))
</script>

<template>
  <section :id="anchor" class="bg-brand text-brand-ink">
    <div class="wrap pt-6 md:pt-10 lg:pt-14">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10 items-end">
        <div class="lg:col-span-7 pb-2 lg:pb-16">
          <p v-if="block.eyebrow" class="tag inline-flex items-center gap-3"><span class="w-2.5 h-2.5 bg-ink" />{{ block.eyebrow }}</p>
          <component
            :is="first ? 'h1' : 'h2'" class="mt-5"
            :class="byLength(block.heading, [[24, 'text-[52px] leading-[.95] sm:text-[80px] lg:text-[84px] xl:text-[108px]']], 'text-[34px] leading-[1] sm:text-[48px] lg:text-[50px] xl:text-[64px]')"
          >{{ tidyText(block.heading) }}</component>
          <p v-if="block.text" class="mt-6 max-w-[33rem] text-[19px] md:text-[21px] leading-[1.45] font-semibold">{{ tidyText(block.text) }}</p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn btn-ink">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
            <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="siteHref(block.secondaryUrl)" class="btn btn-paper">{{ block.secondaryLabel }}</NuxtLink>
          </div>
        </div>
        <div class="lg:col-span-5 relative">
          <!-- (a wide photograph cropped to a tall frame: it has to be as wide as the crop needs) -->
          <div class="border-2 border-ink bg-ink aspect-[4/5] sm:aspect-[3/2] lg:aspect-[4/5] overflow-hidden">
            <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 840px, (min-width: 640px) 100vw, 150vw" class="w-full h-full object-cover" />
          </div>
          <p v-if="todayText" class="absolute left-0 top-0 -translate-y-1/2 -translate-x-2 md:-translate-x-6 bg-ink text-paper px-4 py-3 tag">{{ todayText }}</p>
        </div>
      </div>
    </div>
    <div class="floor-view h-[90px] md:h-[150px] border-y-2 border-ink" aria-hidden="true"><div class="floor checker" /></div>
  </section>
</template>
