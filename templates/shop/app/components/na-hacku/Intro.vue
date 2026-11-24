<script setup lang="ts">
// Na háčku's opening: the pegboard under the header, a card with the headline on two pegs, the
// photograph of the shop hanging beside it, and below the photograph the door sign and two small
// cards (today's hours, where to find the shop), each a little crooked. The sign and the hours are
// the visitor's clock's: they appear once the page is drawn in the browser.
defineProps<{ block: BlockOf<'intro'>; first?: boolean }>()
const { settings, words, week } = await useShop()
const opening = useOpening(week)
const state = computed(() => (opening.value ? (opening.value.open ? 'open' : 'closed') : 'unknown'))
</script>

<template>
  <section class="board pb-16 md:pb-24">
    <div class="wrap pt-2 md:pt-10">
      <div class="grid items-start gap-12 lg:grid-cols-12 lg:gap-10">
        <div class="plate px-6 pb-8 pt-10 md:px-11 md:pb-11 md:pt-12 lg:col-span-6">
          <span class="peg peg-l" /><span class="peg peg-r" />
          <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[2.6rem] md:text-[3.9rem]"><KitMarked :text="block.heading" /></component>
          <p class="mt-5 max-w-[32rem] text-[1.1rem]">{{ tidyText(block.text) }}</p>
          <div class="mt-7 flex flex-wrap gap-3">
            <NuxtLink v-if="block.primaryLabel" :to="siteHref(block.primaryUrl)" class="btn" v-bind="linkAttrs(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
            <NuxtLink v-if="block.secondaryLabel" :to="siteHref(block.secondaryUrl)" class="btn btn-line" v-bind="linkAttrs(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
          </div>
        </div>

        <div class="relative lg:col-span-6 lg:pl-4">
          <div class="plate swing p-2.5" style="--r: 1.4deg">
            <span class="peg" />
            <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 40rem, 100vw" class="aspect-[4/3] w-full rounded-[18px] object-cover" />
          </div>
          <div class="relative z-10 -mt-8 flex flex-wrap items-start gap-x-4 gap-y-2 pl-1 md:-mt-12 md:pl-5">
            <!-- the door sign -->
            <div class="swing relative pt-9" style="--r: -4deg">
              <span class="peg !top-[-7px]" />
              <svg class="absolute left-0 top-0 h-9 w-full text-ink/45" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><path d="M16 36 50 3 84 36" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>
              <p class="sign" :data-state="state" data-open-sign>
                <span class="disp block text-[1.8rem] font-black leading-none tracking-[-0.01em] md:text-[2.4rem]">{{ state === 'closed' ? words.closed : words.open }}</span>
                <span class="mt-1 block text-[0.95rem] font-bold">{{ opening ? words.openDetail(opening.detail) : ' ' }}</span>
              </p>
            </div>
            <div class="mt-9 flex flex-col items-start gap-6 md:mt-0 md:flex-row md:gap-4 lg:max-xl:-mt-6">
              <div class="plate swing !rounded-[18px] px-4 py-3 md:mt-[4.5rem] md:px-5 md:py-3.5" style="--r: 2deg">
                <span class="peg" />
                <p class="whitespace-nowrap text-[0.82rem] font-bold text-[var(--soft)]" :data-state="opening ? 'known' : 'unknown'">{{ words.today }}, {{ opening ? `${words.daysShortLower[opening.day]} ${opening.date}` : ' ' }}</p>
                <p class="disp whitespace-nowrap text-[1.45rem] font-extrabold leading-tight md:text-[1.6rem]" :data-state="opening ? 'known' : 'unknown'" data-today-hours>{{ opening ? dayText(opening.today, words.closedDay) : ' ' }}</p>
              </div>
              <div class="plate swing !rounded-[18px] px-4 py-3 md:mt-[5.5rem] md:px-5 md:py-3.5" style="--r: -1.5deg">
                <span class="peg" />
                <p class="whitespace-nowrap text-[0.82rem] font-bold text-[var(--soft)]">{{ words.nahacku.whereWeAre }}</p>
                <p class="disp whitespace-nowrap text-[1.45rem] font-extrabold leading-tight md:text-[1.6rem]">{{ settings?.address }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
