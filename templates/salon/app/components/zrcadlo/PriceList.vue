<script setup lang="ts">
// Zrcadlo's price list: a column that stays in view (the heading, a line on the dials, the groups
// as links) and the groups on the right as ruled rows: name and note, dials with the minutes, the
// price in the display face. A click on a row starts booking that service.
defineProps<{ block: BlockOf<'pricelist'>; first?: boolean; anchor?: string; groups: ServiceGroupWithItems[] }>()
const words = useSiteWords()
const choice = useBookingChoice()
</script>

<template>
  <section :id="anchor" class="bg-surface rounded-t-[36px] md:rounded-t-[56px] scroll-mt-4">
    <div class="wrap py-16 md:py-24 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-4">
        <div class="lg:sticky lg:top-8">
          <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[38px] md:text-[48px] leading-[1.08]">{{ tidyText(block.heading) }}</component>
          <p v-if="block.text" class="mt-5 max-w-[26rem]">{{ tidyText(block.text) }}</p>
          <ul class="mt-7 flex flex-wrap lg:flex-col gap-2 lg:gap-0 text-[15px] font-semibold text-ink">
            <li v-for="g in groups" :key="g.group.id"><a :href="`#g-${g.group.id}`" class="inline-flex items-center gap-3 min-h-11 px-4 lg:px-0 rounded-full lg:rounded-none bg-paper lg:bg-transparent hover:text-brand">{{ g.group.name }}<span class="hidden lg:inline text-quiet font-normal">{{ g.items.length }}</span></a></li>
          </ul>
          <p class="mt-7 hidden lg:block text-sm text-quiet">{{ words.clickToBook }}</p>
        </div>
      </div>
      <div class="lg:col-span-8">
        <div v-for="(g, gi) in groups" :id="`g-${g.group.id}`" :key="g.group.id" class="scroll-mt-6" :class="gi ? 'mt-12 md:mt-14' : ''">
          <div class="flex items-baseline justify-between gap-4 pb-3 border-b border-ink">
            <h3 class="text-[28px] md:text-[32px] leading-tight">{{ g.group.name }}</h3>
            <span class="label whitespace-nowrap">{{ words.zrcadlo.count(g.items.length) }}</span>
          </div>
          <ul>
            <li v-for="s in g.items" :key="s.id" class="border-b border-line">
              <NuxtLink :to="`/#${anchorOf('booking')}`" :data-service-row="s.name" class="price-row -mx-3 px-3 rounded-2xl grid grid-cols-[1fr_auto] md:grid-cols-[1fr_10.5rem_8.5rem] items-center gap-x-4 gap-y-1.5 py-4 min-h-[64px]" @click="choice.service.value = s.name">
                <span><span class="block text-[17px] font-semibold text-ink leading-snug">{{ s.name }}</span><span v-if="s.note" class="block text-sm text-quiet">{{ s.note }}</span></span>
                <span class="col-start-1 row-start-2 md:col-start-2 md:row-start-1 flex items-center gap-1 text-sm text-quiet"><ZrcadloDials :minutes="s.minutes" /><span class="ml-2 whitespace-nowrap">{{ s.minutes }} {{ words.min }}</span></span>
                <span class="col-start-2 row-start-1 row-span-2 md:row-span-1 md:col-start-3 text-right whitespace-nowrap font-display text-[23px] text-ink"><span v-if="s.priceFrom" class="font-sans text-sm text-quiet mr-1">{{ words.from }}</span>{{ kc(s.price, true) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
