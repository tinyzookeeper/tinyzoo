<script setup lang="ts">
// Časomíra's closing call: a board that shows the places still free, in lit figures, and the
// registration button.
import type { Track } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'closing'>; first?: boolean; tracks: Track[] }>()
const { words, cta, phase } = await useEvent()
const places = computed(() => placesOf(props.tracks))
</script>

<template>
  <section class="pb-16 sm:pb-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap">
      <div class="board p-6 sm:p-10 lg:p-14 grid lg:grid-cols-[1fr_auto] gap-8 items-end">
        <div>
          <p v-if="block.label" class="mono text-quiet">{{ block.label }}</p>
          <div class="mt-3 flex items-baseline gap-4 flex-wrap">
            <span class="led text-[clamp(5rem,17vw,11rem)]">{{ places.free }}</span>
            <component :is="first ? 'h1' : 'h2'" class="text-2xl sm:text-4xl font-extrabold tracking-[-0.03em]">
              <template v-for="(line, i) in tidyText(withPlaces(block.heading, places)).split('\n')" :key="i"><br v-if="i" class="hidden sm:block">{{ i ? ' ' : '' }}{{ line }}</template>
            </component>
          </div>
          <span class="meter mt-6 max-w-[40rem] !h-4" :style="{ '--p': places.taken }" />
        </div>
        <div class="flex flex-col gap-3 lg:min-w-[17rem]">
          <a v-if="cta" :href="cta.url" class="btn !min-h-[64px] !text-xl" data-register>{{ cta.label }} <UIcon name="i-lucide-arrow-up-right" class="ico" aria-hidden="true" /></a>
          <p v-else-if="phase === 'closed'" class="mono text-quiet" data-registration-closed>{{ words.registrationClosed }}</p>
          <p v-if="block.note" class="mono text-quiet">{{ block.note }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
