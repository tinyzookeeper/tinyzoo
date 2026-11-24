<script setup lang="ts">
// Soutisk's routes: four paper cards on petrol, each topped by its own profile printed as a
// solid hill under a printed sun, then its figures, a thick bar of places taken and a button.
// A row to swipe on a phone; four in a grid from a desktop's width.
import type { Track } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'routes'>; first?: boolean; anchor?: string; tracks: Track[] }>()
const { words, registerUrl } = await useEvent()
const fees = await useFees()
const scale = computed(() => profileScale(props.tracks))
const drawings = computed(() => props.tracks.map((t) => drawProfile(t, scale.value)))
// Each card prints its hill in one ink and its sun in another, round the three of the palette.
const HILLS = ['var(--c1)', 'var(--c3)', 'var(--c2)', 'var(--c1)']
const SUNS = ['var(--c2)', 'var(--c2)', 'var(--c1)', 'var(--c3)']
</script>

<template>
  <section :id="anchor" class="on-dark relative bg-c3 text-paper pt-10 sm:pt-14 pb-24 sm:pb-36">
    <div class="wrap">
      <div class="grid lg:grid-cols-12 gap-x-8 gap-y-4 items-end">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        </div>
        <p v-if="block.text" class="lg:col-span-5 text-lg">{{ tidyText(block.text) }}</p>
      </div>
    </div>
    <UCarousel
      v-slot="{ item: track, index: i }" :items="tracks" align="start" contain-scroll="trimSnaps" drag-free
      :breakpoints="{ '(min-width: 1024px)': { active: false } }" class="mt-10"
      :ui="{ viewport: 'px-5 md:px-10 lg:max-w-[82rem] lg:mx-auto', container: 'items-stretch -ms-4 lg:-ms-5', item: 'basis-[82vw] sm:basis-[24rem] lg:basis-0 lg:grow ps-4 lg:ps-5' }"
    >
      <article :data-track="track.id" class="card flex flex-col overflow-hidden h-full" :style="{ '--hill': HILLS[i % 4], '--sun': SUNS[i % 4] }">
        <div class="relative h-36 bg-paper2" aria-hidden="true">
          <span class="ink-m absolute right-7 top-4 w-16 h-16 rounded-full" style="background:var(--sun)" />
          <svg v-if="drawings[i]" viewBox="0 0 1000 100" preserveAspectRatio="none" class="ink-m absolute inset-0 w-full h-full"><path :d="drawings[i]!.area" fill="var(--hill)" /></svg>
        </div>
        <div class="p-6 flex flex-col grow">
          <p class="disp text-[3.1rem]">{{ track.figure }} km</p>
          <h3 class="disp text-[1.45rem] mt-2">{{ track.name }}</h3>
          <p v-if="track.description" class="mt-3 text-quiet grow">{{ tidyText(track.description) }}</p>
          <dl class="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t-2 border-ink pt-4">
            <div><dt class="text-sm text-quiet">{{ words.length }}</dt><dd class="font-bold text-lg">{{ track.exactLength || track.length }}</dd></div>
            <div><dt class="text-sm text-quiet">{{ words.elevation }}</dt><dd class="font-bold text-lg">{{ track.elevation }}</dd></div>
            <div><dt class="text-sm text-quiet">{{ words.start }}</dt><dd class="font-bold text-lg">{{ track.startTime }}</dd></div>
            <div><dt class="text-sm text-quiet">{{ words.feeFrom }}</dt><dd class="font-bold text-lg">{{ priceIn(track, fees.current.value) != null ? `${priceIn(track, fees.current.value)} ${words.crowns}` : '' }}</dd></div>
          </dl>
          <p class="mt-5 flex justify-between items-baseline"><span class="font-bold">{{ words.placesRemaining(track.free ?? 0) }}</span><span class="text-sm text-quiet">{{ words.outOf(track.capacity ?? 0) }}</span></p>
          <span class="bar mt-1.5"><i :style="{ width: `${takenPercent(track)}%` }" /></span>
          <a v-if="registerUrl(track)" :href="registerUrl(track)!" class="btn w-full mt-6" data-register>{{ track.registerLabel || words.signUp }} <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" /></a>
        </div>
      </article>
    </UCarousel>
    <p v-if="block.links.length" class="wrap mt-7 flex flex-wrap gap-x-7 gap-y-1">
      <a v-for="l in block.links" :key="l.id" :href="siteHref(l.url)" class="ulink" :target="isExternal(l.url) ? '_blank' : undefined" :rel="isExternal(l.url) ? 'noopener' : undefined">{{ l.label }}</a>
    </p>
  </section>
</template>
