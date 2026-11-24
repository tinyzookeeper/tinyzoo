<script setup lang="ts">
// Šachovnice's price list: the heading with its text beside it, chips that jump to a group, then
// every group as a numbered block: its name on the left and heavy ruled rows on the right (name,
// minutes, a row of small squares, price). The whole row turns to the brand colour on hover.
defineProps<{ block: BlockOf<'pricelist'>; first?: boolean; anchor?: string; groups: ServiceGroupWithItems[] }>()
const words = useSiteWords()
const choice = useBookingChoice()
</script>

<template>
  <section :id="anchor" class="wrap py-16 md:py-24 scroll-mt-2">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
      <component :is="first ? 'h1' : 'h2'" class="lg:col-span-7" :class="wideHeading(block.heading)">{{ tidyText(block.heading) }}</component>
      <p v-if="block.text" class="lg:col-span-5 max-w-[30rem] text-[18px]">{{ tidyText(block.text) }}</p>
    </div>
    <ul class="mt-8 flex flex-wrap gap-2">
      <li v-for="g in groups" :key="g.group.id"><a :href="`#g-${g.group.id}`" class="inline-flex items-center min-h-11 px-4 border-2 border-ink font-bold text-[16px] hover:bg-ink hover:text-paper transition-colors">{{ g.group.name }}</a></li>
    </ul>
    <div class="mt-12 md:mt-16">
      <div v-for="(g, gi) in groups" :id="`g-${g.group.id}`" :key="g.group.id" class="scroll-mt-4 grid lg:grid-cols-12 gap-x-10 gap-y-5" :class="gi ? 'mt-14 md:mt-20' : ''">
        <div class="lg:col-span-4">
          <div class="lg:sticky lg:top-6 flex lg:block items-center gap-4">
            <span class="flex-none inline-flex items-center justify-center w-11 h-11 bg-ink text-paper font-display font-bold text-[14px]">{{ String(gi + 1).padStart(2, '0') }}</span>
            <div>
              <h3 class="lg:mt-5 text-[24px] md:text-[30px] leading-[1.1] font-bold">{{ g.group.name }}</h3>
              <p class="hidden lg:block mt-3 text-[16px] font-semibold text-soft">{{ words.sachovnice.group(g.items.length, kc(cheapest(g.items))) }}</p>
            </div>
          </div>
        </div>
        <ul class="lg:col-span-8 border-b-2 border-ink">
          <li v-for="s in g.items" :key="s.id" class="border-t-2 border-ink">
            <NuxtLink :to="`/#${anchorOf('booking')}`" :data-service-row="s.name" class="brow grid grid-cols-[1fr_auto] md:grid-cols-[1fr_14.5rem_9rem] items-center gap-x-5 gap-y-2 px-3 py-4 min-h-[68px]" @click="choice.service.value = s.name">
              <span><span class="block text-[19px] font-extrabold leading-snug">{{ s.name }}</span><span v-if="s.note" class="block text-[15px] font-semibold opacity-75">{{ s.note }}</span></span>
              <span class="col-span-2 md:col-span-1 col-start-1 row-start-2 md:col-start-2 md:row-start-1 flex items-center gap-3">
                <span class="w-[4.2rem] flex-none text-[15px] font-bold whitespace-nowrap">{{ s.minutes }} {{ words.min }}</span>
                <span class="flex items-center" aria-hidden="true"><span v-for="n in quarters(s.minutes)" :key="n" class="q" /></span>
              </span>
              <span class="col-start-2 row-start-1 md:col-start-3 text-right whitespace-nowrap font-display font-bold text-[18px] md:text-[20px]"><span v-if="s.priceFrom" class="font-sans font-bold text-[15px] mr-1.5">{{ words.from }}</span>{{ kc(s.price) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
