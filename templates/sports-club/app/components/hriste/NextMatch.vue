<script setup lang="ts">
// Hřiště's opening: a short headline, one wide photograph and the next match as a white
// scoreboard card laid over the photograph's lower edge: both teams (with their place in the
// table), the kick-off in large numerals, the ground, the admission and two buttons.
import type { NextView } from '~/composables/useClub'

const props = defineProps<{ block: BlockOf<'nextMatch'>; first?: boolean; next: NextView }>()
const { settings, name, words } = await useClub()
const m = computed(() => props.next.match)
const before = computed(() => splitComma(props.block.preMatch))
const standing = (us: boolean) => (us ? props.next.ours : props.next.theirs)
const sides = computed(() => (m.value ? [m.value.home, m.value.away].map((side) => ({ ...side, place: standing(side.us) })) : []))
const preMatch = computed(() => (before.value[0] ? [before.value[0], words.value.preMatch.toLowerCase() + (before.value[1] ? `: ${before.value[1]}` : '')].join(' ') : ''))
</script>

<template>
  <section class="wrap pt-4 lg:pt-6" data-next-match>
    <div class="rise grid items-end gap-x-12 gap-y-4 lg:grid-cols-12">
      <div class="lg:col-span-7">
        <component :is="first ? 'h1' : 'h2'" class="disp text-[clamp(38px,5.2vw,72px)] !leading-[1.02] [&_em]:block [&_em]:text-brand">
          <KitMarked v-if="block.heading" :text="block.heading" />
          <template v-else-if="m">{{ m.home.name }} <em>– {{ m.away.name }}</em></template>
          <template v-else>{{ name }}</template>
        </component>
      </div>
      <p v-if="block.lead" class="max-w-[30rem] text-[18px] text-quiet lg:col-span-5 lg:justify-self-end lg:pb-2 lg:text-[19px]">{{ tidyText(block.lead) }}</p>
    </div>

    <figure v-if="block.image" class="photo rise rise-2 relative mt-6 lg:mt-8">
      <CmsImage :media="block.image" eager sizes="(min-width: 1304px) 1304px, 100vw" class="aspect-[4/3] w-full object-cover sm:aspect-[2/1] lg:aspect-[2.85/1]" />
      <figcaption v-if="block.caption" class="absolute left-3 top-3 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium leading-snug text-ink sm:left-5 sm:top-5">{{ tidyText(block.caption) }}</figcaption>
    </figure>

    <div v-if="m" class="rise rise-3 relative z-10 mx-auto max-w-[1180px] rounded-[28px] bg-white p-4 pt-5 shadow-(--shadow-card) sm:w-[calc(100%-48px)] sm:p-7 lg:px-10 lg:py-8" :class="block.image ? '-mt-12 lg:-mt-28' : 'mt-6'">
      <p class="eyebrow text-center">{{ words.nextMatch }}<span v-if="next.squad?.competition" class="max-sm:hidden"> · {{ next.squad.competition }}</span><template v-if="m.round"> · {{ words.round(m.round) }}</template></p>
      <div class="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 sm:gap-x-8">
        <div v-for="(side, i) in sides.slice(0, 1)" :key="`h${i}`" class="flex flex-col items-center gap-2 text-center lg:flex-row-reverse lg:justify-start lg:gap-5 lg:text-right">
          <span class="avatar h-14 w-14 text-[20px] lg:h-[72px] lg:w-[72px] lg:text-[26px]" :class="side.us ? 'avatar-us' : ''" aria-hidden="true">{{ initialsOf(side.name) }}</span>
          <p><span class="block font-display text-[16px] font-extrabold leading-tight sm:text-[21px] lg:text-[27px]">{{ side.name }}</span><span v-if="side.place" class="mt-1 block text-[13px] leading-tight text-quiet lg:text-[15px]">{{ words.place(side.place.place) }}<span class="max-lg:hidden"> · </span><br class="lg:hidden">{{ words.points(side.place.row.points) }}</span></p>
        </div>
        <div class="text-center">
          <p class="text-[13px] font-semibold leading-tight text-quiet lg:text-[15px]">{{ weekday(m.at) }} {{ dayMonth(m.at) }}</p>
          <p class="num mt-1.5 text-[40px] sm:text-[52px] lg:text-[68px]">{{ m.time }}</p>
        </div>
        <div v-for="(side, i) in sides.slice(1)" :key="`a${i}`" class="flex flex-col items-center gap-2 text-center lg:flex-row lg:gap-5 lg:text-left">
          <span class="avatar h-14 w-14 text-[20px] lg:h-[72px] lg:w-[72px] lg:text-[26px]" :class="side.us ? 'avatar-us' : ''" aria-hidden="true">{{ initialsOf(side.name) }}</span>
          <p><span class="block font-display text-[16px] font-extrabold leading-tight sm:text-[21px] lg:text-[27px]">{{ side.name }}</span><span v-if="side.place" class="mt-1 block text-[13px] leading-tight text-quiet lg:text-[15px]">{{ words.place(side.place.place) }}<span class="max-lg:hidden"> · </span><br class="lg:hidden">{{ words.points(side.place.row.points) }}</span></p>
        </div>
      </div>
      <div class="mt-5 flex flex-col gap-x-8 gap-y-5 border-t border-line pt-5 lg:mt-6 lg:flex-row lg:items-center lg:justify-between lg:pt-6">
        <ul class="flex flex-col gap-x-7 gap-y-2 text-[15.5px] sm:flex-row sm:flex-wrap">
          <li class="flex items-center gap-2.5"><UIcon name="i-lucide-map-pin" class="text-[19px] text-brand" aria-hidden="true" />{{ m.isHome ? settings?.groundName : words.away }}</li>
          <li v-if="m.isHome && settings?.admission" class="flex items-center gap-2.5"><UIcon name="i-lucide-ticket" class="text-[19px] text-brand" aria-hidden="true" />{{ settings.admission }}</li>
          <li v-if="preMatch" class="flex items-center gap-2.5"><UIcon name="i-lucide-clock-3" class="text-[19px] text-brand" aria-hidden="true" />{{ preMatch }}</li>
        </ul>
        <div v-if="block.primaryLabel || block.secondaryLabel" class="grid grid-cols-2 gap-2.5 sm:flex sm:flex-none">
          <NuxtLink v-if="block.primaryLabel" class="btn !px-5" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
          <NuxtLink v-if="block.secondaryLabel" class="btn btn-soft !px-5" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
