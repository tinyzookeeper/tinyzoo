<script setup lang="ts">
// Soutisk's closing call: vermilion under a line of hills, one question set very large and
// the registration button.
import type { Track } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'closing'>; first?: boolean; tracks: Track[] }>()
const { words, cta, phase } = await useEvent()
const places = computed(() => placesOf(props.tracks))
</script>

<template>
  <section class="relative bg-c1 pt-4 sm:pt-8 pb-24 sm:pb-36" :class="first ? 'mt-14 sm:mt-28' : ''">
    <svg class="hills text-c1" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><use href="#soutisk-hl3" fill="currentColor" /></svg>
    <div class="wrap grid lg:grid-cols-[1fr_auto] gap-x-10 gap-y-7 items-end">
      <div>
        <component :is="first ? 'h1' : 'h2'" class="disp text-[clamp(2.7rem,8.4vw,7rem)] leading-[0.98] tracking-[-0.04em]">{{ tidyText(withPlaces(block.heading, places)).replace(/\s*\n\s*/g, ' ') }}</component>
        <p v-if="block.text" class="mt-7 text-[1.3rem] sm:text-2xl font-bold max-w-[36rem] leading-snug">{{ tidyText(block.text) }}</p>
      </div>
      <a v-if="cta" :href="cta.url" class="btn !min-h-[68px] !text-xl !px-9" data-register>{{ cta.label }} <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" /></a>
      <p v-else-if="phase === 'closed'" class="font-bold text-xl" data-registration-closed>{{ words.registrationClosed }}</p>
    </div>
  </section>
</template>
