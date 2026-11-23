<script setup lang="ts">
// Dres's opening: continues the masthead's band of the club colour. The two teams as a headline in
// very wide capitals, and a black scoreboard of date, kick-off and ground that hangs over the
// edge of the band into the photograph below.
import type { NextView } from '~/composables/useClub'

const props = defineProps<{ block: BlockOf<'nextMatch'>; first?: boolean; next: NextView }>()
const { settings, name, words } = await useClub()
const m = computed(() => props.next.match)
const eyebrow = computed(() => [words.value.nextMatch, m.value?.round ? words.value.round(m.value.round) : '', props.next.squad?.competition].filter(Boolean).join(' · '))
const before = computed(() => splitComma(props.block.preMatch))
const facts = computed(() => [
  m.value?.isHome && settings.value?.admission ? `${words.value.admission} ${settings.value.admission}.` : '',
  before.value[0] ? words.value.preMatchLine(before.value[0], before.value[1]) : '',
].filter(Boolean).join(' '))
const day = computed(() => (m.value ? capital(weekday(m.value.at)) : ''))
</script>

<template>
  <section class="stripes bg-brand text-brand-ink" data-next-match>
    <div class="wrap pb-0 pt-8 lg:pt-14">
      <p v-if="eyebrow" class="cap">{{ eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="wide mt-4 break-words text-[9.4vw] sm:text-[clamp(30px,6.3vw,96px)] [&_em]:block [&_em]:not-italic">
        <KitMarked v-if="block.heading" :text="block.heading" />
        <template v-else-if="m">{{ m.home.name }} <span class="block"><span class="inline-block -translate-y-[.12em] text-[.62em]" aria-hidden="true">×</span><span class="sr-only">{{ words.against }}</span> {{ m.away.name }}</span></template>
        <template v-else>{{ name }}</template>
      </component>
      <p v-if="block.lead" class="mt-5 max-w-[40rem] text-[19px] font-medium leading-snug lg:text-[22px]">{{ tidyText(block.lead) }}</p>

      <div v-if="m" class="dark relative z-10 mt-8 grid translate-y-8 grid-cols-2 bg-ink text-paper lg:mt-10 lg:grid-cols-[auto_auto_1fr_auto]">
        <div class="border-r border-paper/20 p-5 lg:p-7">
          <p class="cap text-paper/70">{{ day }}</p>
          <p class="wide mt-2 text-[clamp(26px,7vw,80px)] lg:text-[clamp(38px,5.6vw,80px)]">{{ dayMonth(m.at, 'slash') }}</p>
        </div>
        <div class="p-5 lg:border-r lg:border-paper/20 lg:p-7">
          <p class="cap text-paper/70">{{ words.kickoff }}</p>
          <p class="wide mt-2 text-[clamp(26px,7vw,80px)] lg:text-[clamp(38px,5.6vw,80px)]">{{ m.time }}</p>
        </div>
        <div class="col-span-2 border-t border-paper/20 p-5 lg:col-span-1 lg:border-t-0 lg:p-7">
          <p class="cap text-paper/70">{{ words.where }}</p>
          <p class="head mt-2 text-[24px] lg:text-[30px]">{{ m.isHome ? settings?.groundName : words.away }}</p>
          <p v-if="facts" class="mt-2 max-w-md text-[15px] text-paper/80">{{ facts }}</p>
        </div>
        <NuxtLink v-if="block.primaryLabel" :to="siteHref(block.primaryUrl)" class="btn btn-paper col-span-2 !min-h-16 lg:col-span-1 lg:!px-10">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-down" class="text-lg" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </section>
</template>
