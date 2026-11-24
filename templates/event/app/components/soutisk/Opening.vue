<script setup lang="ts">
// Soutisk's opening: the name in very heavy type beside a round photograph that rises like the
// sun; below them three hills printed over each other, and the countdown on the nearest ridge,
// which runs straight into the routes. After the start the countdown gives way to the results
// and the photographs.
// (`fees` is handed to every look's opening; this one has no use for it)
defineProps<{ block: BlockOf<'opening'>; first?: boolean; fees: Awaited<ReturnType<typeof useFees>> }>()
const { settings, name, words, day, phase, countdown, cta } = await useEvent({ tick: true })
// The name breaks after its first word, as the design sets it; its size steps down for a longer one.
const lines = computed(() => {
  const [first, ...rest] = name.value.trim().split(/\s+/)
  return [first ?? '', rest.join(' ')]
})
const nameSize = computed(() => byLength(lines.value.reduce((a, b) => (b.length > a.length ? b : a), ''), [
  [NAME_LENGTHS.short / 2, 'text-[clamp(4.6rem,21vw,11.5rem)] lg:text-[clamp(7rem,11.2vw,10.1rem)]'],
  [NAME_LENGTHS.short, 'text-[clamp(3rem,13vw,7rem)] lg:text-[clamp(4.5rem,7.5vw,7rem)]'],
], 'text-[clamp(2.2rem,9vw,4.5rem)] lg:text-[clamp(3rem,5vw,4.5rem)]'))
</script>

<template>
  <section class="relative overflow-hidden" data-opening>
    <div class="wrap relative grid lg:grid-cols-12 gap-x-8 gap-y-8 pt-4 lg:pt-6 pb-[12rem] sm:pb-[17rem] lg:pb-[14.5rem]">
      <div class="lg:col-span-7 relative z-20">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="disp leading-[0.92] tracking-[-0.045em] mt-3 lg:mt-4" :class="nameSize">{{ lines[0] }}<template v-if="lines[1]"><br>{{ lines[1] }}</template></component>
        <p v-if="day || settings?.venueName" class="mt-6 text-[1.35rem] sm:text-2xl font-bold leading-snug">
          <time v-if="day" :datetime="day.iso">{{ day.weekday }} {{ day.date }}</time><br v-if="day && settings?.venueName">
          <span v-if="settings?.venueName" class="font-medium">{{ settings.venueName }} {{ tidyText(settings.venueArea) }}</span>
        </p>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <template v-if="phase === 'over'">
            <a :href="`#${words.anchors.results}`" class="btn !min-h-[60px] !text-xl">{{ words.results }} <UIcon name="i-lucide-arrow-down" aria-hidden="true" /></a>
            <a :href="`#${words.anchors.gallery}`" class="btn btn-line !min-h-[60px]">{{ words.photos }}</a>
          </template>
          <template v-else>
            <a v-if="cta" :href="cta.url" class="btn !min-h-[60px] !text-xl" data-register>{{ cta.label }} <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" /></a>
            <p v-else class="font-bold text-xl" data-registration-closed>{{ words.registrationClosed }}</p>
            <a v-if="block.secondaryLabel && block.secondaryUrl" :href="siteHref(block.secondaryUrl)" class="btn btn-line !min-h-[60px]">{{ block.secondaryLabel }}</a>
          </template>
        </div>
      </div>
      <div class="lg:col-span-5 relative">
        <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 32rem, (min-width: 640px) 28rem, 84vw" class="w-[min(84vw,24rem)] sm:w-[28rem] lg:w-[32rem] max-w-none aspect-square rounded-full object-cover ml-auto lg:absolute lg:top-0 lg:-right-2" />
      </div>
    </div>
    <!-- three hills, printed over each other -->
    <svg viewBox="0 0 1440 320" preserveAspectRatio="none" class="ink-m absolute inset-x-0 bottom-0 w-full h-[15rem] sm:h-[20rem] lg:h-[21rem] z-10 pointer-events-none" aria-hidden="true">
      <path style="mix-blend-mode:multiply" fill="var(--c2)" d="M0 320V236C120 200 220 160 330 178C450 198 520 262 640 252C800 238 900 62 1080 42C1240 24 1350 122 1440 172V320Z" />
      <path style="mix-blend-mode:multiply" fill="var(--c1)" d="M0 320V262C100 244 180 252 280 224C420 182 520 76 700 84C860 92 940 204 1080 232C1220 260 1340 242 1440 252V320Z" />
      <path style="mix-blend-mode:multiply" fill="var(--c3)" d="M0 320V196C80 158 170 118 290 128C430 140 520 218 680 224C860 230 1000 196 1160 204C1280 210 1380 218 1440 208V320Z" />
    </svg>
    <!-- the nearest ridge: it carries the countdown and runs into the next section -->
    <svg viewBox="0 0 1440 320" preserveAspectRatio="none" class="absolute inset-x-0 -bottom-px w-full h-[19rem] sm:h-[20rem] lg:h-[21rem] z-10 pointer-events-none" aria-hidden="true">
      <path fill="var(--c3)" d="M0 320V228C200 204 420 242 680 234C940 226 1140 202 1440 228V320Z" />
    </svg>
    <div class="absolute inset-x-0 bottom-0 z-20 text-paper">
      <div v-if="phase !== 'over'" class="wrap pb-4 sm:pb-7 flex flex-wrap items-baseline gap-x-6" role="timer" :aria-label="words.countdownAria">
        <span class="kicker w-full sm:w-auto">{{ block.countdownLabel }}</span>
        <span class="flex items-baseline gap-x-4 sm:gap-x-5 whitespace-nowrap">
          <span><span class="disp text-[1.9rem] sm:text-[3.25rem]" data-cd="d">{{ countdown.d }}</span> <span class="font-bold text-sm sm:text-base">{{ words.unitsLong[0] }}</span></span>
          <span><span class="disp text-[1.9rem] sm:text-[3.25rem]" data-cd="h">{{ countdown.h }}</span> <span class="font-bold text-sm sm:text-base">{{ words.unitsLong[1] }}</span></span>
          <span><span class="disp text-[1.9rem] sm:text-[3.25rem]" data-cd="m">{{ countdown.m }}</span> <span class="font-bold text-sm sm:text-base">{{ words.unitsLong[2] }}</span></span>
        </span>
      </div>
      <div v-else class="wrap pb-4 sm:pb-7 flex flex-wrap items-baseline gap-x-6">
        <span class="kicker">{{ words.finished }}</span>
        <span class="disp text-[1.4rem] sm:text-[2.2rem]" data-finished>{{ words.finishedText }}</span>
      </div>
    </div>
  </section>
</template>
