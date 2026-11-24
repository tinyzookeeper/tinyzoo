<script setup lang="ts">
// Časomíra's opening: a full-width photograph made in low light under a light scrim, the name
// in heavy type, and the clock on a board across the page, with a row of facts under it. After
// the start the clock gives way to the results and the photographs.
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; fees: Awaited<ReturnType<typeof useFees>> }>()
const { settings, name, words, day, phase, countdown, cta } = await useEvent({ tick: true })
const photo = computed(() => props.block.darkImage ?? props.block.image)
const places = computed(() => placesOf(props.fees.tracks.value))
// The name is set at the design's size for its own short name, smaller for a longer one.
const nameSize = computed(() => byLength(name.value, [[NAME_LENGTHS.short, 'text-[clamp(4rem,10vw,8.75rem)]'], [NAME_LENGTHS.medium, 'text-[clamp(3rem,7vw,6rem)]']], 'text-[clamp(2.2rem,5vw,4rem)]'))
</script>

<template>
  <section class="relative isolate" data-opening>
    <div v-if="photo" class="absolute inset-x-0 top-0 h-[20rem] sm:h-[37rem] -z-10">
      <CmsImage :media="photo" eager sizes="100vw" class="w-full h-full object-cover" />
      <div class="scrim absolute inset-0" />
      <div class="scrim-l absolute inset-0" />
    </div>
    <div class="wrap pt-[14.5rem] sm:pt-[11rem]">
      <p v-if="block.eyebrow" class="mono idx !text-text">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="font-black leading-[0.88] tracking-[-0.05em] mt-4" :class="nameSize">{{ name }}</component>
      <p v-if="block.lead" class="mt-5 text-lg sm:text-xl max-w-[36rem] text-text/90">{{ tidyText(block.lead) }}</p>

      <div class="board mt-8 sm:mt-10 p-5 sm:p-8 lg:p-10 grid lg:grid-cols-[1fr_auto] gap-x-10 gap-y-7 items-end">
        <div v-if="phase !== 'over'" class="min-w-0" role="timer" :aria-label="words.countdownAria">
          <p class="mono text-quiet">{{ block.countdownLabel }}</p>
          <div class="clock led mt-3 text-[14.5vw] sm:text-[5.5rem] lg:text-[min(7.4rem,7.6vw)]">
            <div><span data-cd="d">{{ countdown.d }}</span><span class="unit mono">{{ words.unitsShort[0] }}</span></div>
            <i class="sep" aria-hidden="true" />
            <div><span data-cd="h">{{ countdown.h }}</span><span class="unit mono">{{ words.unitsShort[1] }}</span></div>
            <i class="sep" aria-hidden="true" />
            <div><span data-cd="m">{{ countdown.m }}</span><span class="unit mono">{{ words.unitsShort[2] }}</span></div>
            <i class="sep hidden md:block" aria-hidden="true" />
            <div class="hidden md:block"><span data-cd="s">{{ countdown.s }}</span><span class="unit mono">{{ words.unitsShort[3] }}</span></div>
          </div>
        </div>
        <div v-else class="min-w-0">
          <p class="mono text-quiet">{{ words.finished }}</p>
          <p class="mt-3 text-2xl sm:text-4xl font-extrabold tracking-[-0.03em] max-w-[32rem]" data-finished>{{ words.finishedText }}</p>
        </div>
        <div class="min-w-0 flex flex-col gap-3 lg:w-[17rem]">
          <template v-if="phase === 'over'">
            <a :href="`#${words.anchors.results}`" class="btn !min-h-[64px] !text-xl">{{ words.results }} <UIcon name="i-lucide-arrow-down" class="ico" aria-hidden="true" /></a>
            <a :href="`#${words.anchors.gallery}`" class="btn btn-line">{{ words.photos }}</a>
          </template>
          <template v-else>
            <a v-if="cta" :href="cta.url" class="btn !min-h-[64px] !text-xl" data-register>{{ cta.label }} <UIcon name="i-lucide-arrow-up-right" class="ico" aria-hidden="true" /></a>
            <p v-else class="mono text-quiet !min-h-[64px] flex items-center" data-registration-closed>{{ words.registrationClosed }}</p>
            <a v-if="block.secondaryLabel && block.secondaryUrl" :href="siteHref(block.secondaryUrl)" class="btn btn-line">{{ block.secondaryLabel }}</a>
          </template>
        </div>
      </div>

      <dl class="grid grid-cols-2 lg:grid-cols-4 border-b border-line">
        <div class="py-5 pr-4">
          <dt class="mono text-quiet">{{ words.date }}</dt>
          <dd class="mt-1 text-xl font-bold tracking-[-0.02em]"><time v-if="day" :datetime="day.iso">{{ day.weekday }} {{ day.date }}</time></dd>
        </div>
        <div class="py-5 pl-4 lg:px-6 border-l border-line">
          <dt class="mono text-quiet">{{ words.place }}</dt>
          <dd class="mt-1 text-xl font-bold tracking-[-0.02em]">{{ settings?.venueName }} <span v-if="settings?.venueArea" class="font-normal text-quiet">{{ tidyText(settings.venueArea) }}</span></dd>
        </div>
        <div v-if="places.capacity" class="py-5 pr-4 lg:px-6 border-t lg:border-t-0 lg:border-l border-line">
          <dt class="mono text-quiet">{{ words.placesLeft }}</dt>
          <dd class="mt-1 text-xl font-bold tracking-[-0.02em]">{{ places.free }} <span class="font-normal text-quiet">{{ words.outOf(places.capacity) }}</span><span class="meter mt-2 max-w-[12rem]" :style="{ '--p': places.taken }" /></dd>
        </div>
        <div v-if="fees.cheapest.value != null" class="py-5 pl-4 lg:pl-6 border-t lg:border-t-0 border-l border-line">
          <dt class="mono text-quiet">{{ words.feeNow }}</dt>
          <dd class="mt-1 text-xl font-bold tracking-[-0.02em]">{{ words.from(formatPrice(fees.cheapest.value)) }} <span v-if="fees.until.value" class="font-normal text-quiet">{{ words.until(fees.until.value) }}</span></dd>
        </div>
      </dl>
    </div>
  </section>
</template>
