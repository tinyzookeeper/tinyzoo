<script setup lang="ts">
// Regál's opening: a short line above, the headline set very large, and beside it a card in
// two parts: the rail with today's date and the open sign, and the hours in big condensed figures.
// The state and the hours are the visitor's clock's: they appear once the page is drawn in the browser.
defineProps<{ block: BlockOf<'intro'>; first?: boolean }>()
const { words, week, place } = await useShop()
const opening = useOpening(week)
const known = computed(() => (opening.value ? 'known' : 'unknown'))
// A long headline steps down: "Máme to skladem." is the design's own size.
const sizes: Array<[number, string]> = [[18, 'text-[clamp(3.3rem,15.5vw,5.2rem)] md:text-[clamp(5.2rem,7.6vw,7rem)]'], [32, 'text-[clamp(2.6rem,11vw,3.6rem)] md:text-[clamp(3.6rem,5.2vw,4.8rem)]']]
</script>

<template>
  <section class="wrap pt-6 md:pt-7">
    <div class="grid items-end gap-8 lg:grid-cols-12 lg:gap-10">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="cond text-[1.2rem]"><template v-for="(part, i) in slashParts(block.eyebrow)" :key="i"><template v-if="i">{{ ' ' }}<span class="mx-1 opacity-50">/</span>{{ ' ' }}</template>{{ part }}</template></p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 font-bold leading-[0.95] tracking-[-0.045em]" :class="byLength(block.heading, sizes, 'text-[2.6rem] md:text-[3.6rem]')"><KitMarked :text="block.heading" /></component>
      </div>
      <div class="lg:col-span-5 lg:pb-3">
        <div class="flex items-stretch bg-white">
          <div class="flex flex-col justify-between bg-rail px-4 py-4 text-rail-ink">
            <p class="cond text-[1.1rem] leading-[1.05]" :data-state="known">{{ words.today }}<br>{{ opening ? `${words.daysShortLower[opening.day]} ${opening.date}` : ' ' }}</p>
            <p class="cond flex items-center gap-1.5 text-[1.1rem]" :data-state="known" data-open-sign><span class="dot" :data-closed="opening?.open === false" />{{ opening?.open === false ? words.closed : words.open }}</p>
          </div>
          <div class="min-w-0 flex-1 px-5 py-4">
            <p class="num whitespace-nowrap text-[clamp(3rem,14vw,4.6rem)] lg:max-xl:text-[3.1rem]" :data-state="known" data-today-hours>{{ opening ? dayText(opening.today, words.closedDay) : ' ' }}</p>
            <p class="mt-2 text-[0.95rem] font-semibold"><span :data-state="known">{{ opening ? words.openSentence(opening.open, opening.detail) : ' ' }}</span> {{ place }}.</p>
          </div>
        </div>
        <p class="mt-5 max-w-[34rem] text-[1.1rem] leading-snug">{{ tidyText(block.text) }}</p>
        <div class="mt-5 flex flex-wrap gap-3">
          <NuxtLink v-if="block.primaryLabel" :to="siteHref(block.primaryUrl)" class="btn" v-bind="linkAttrs(block.primaryUrl)">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="icon" aria-hidden="true" /></NuxtLink>
          <NuxtLink v-if="block.secondaryLabel" :to="siteHref(block.secondaryUrl)" class="btn btn-line" v-bind="linkAttrs(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
