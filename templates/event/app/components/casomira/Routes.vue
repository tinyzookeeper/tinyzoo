<script setup lang="ts">
// Časomíra's routes: one lane for each on a shared kilometre axis. Each profile is drawn at its
// true relative length (the longest route fills the lane, one a quarter as long a quarter of
// it), with the figures in mono and the places left as a row of diodes.
import type { Track } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'routes'>; first?: boolean; anchor?: string; tracks: Track[] }>()
const { words, registerUrl } = await useEvent()
const fees = await useFees()
const scale = computed(() => profileScale(props.tracks))
const drawings = computed(() => props.tracks.map((t) => drawProfile(t, scale.value)))
// The ticks of the axis: every six kilometres, the end of the longest route at the right edge.
const ticks = computed(() => Array.from({ length: Math.max(0, Math.ceil(scale.value.kmMax / 6) - 1) }, (_, i) => ({ km: (i + 1) * 6, left: (((i + 1) * 6) / scale.value.kmMax) * 100 })).filter((t) => t.left < 95))
</script>

<template>
  <section :id="anchor" class="py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap">
      <div class="grid lg:grid-cols-12 gap-x-8 gap-y-4 items-end">
        <div class="lg:col-span-8">
          <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
        </div>
        <p v-if="block.text" class="lg:col-span-4 text-quiet">{{ tidyText(block.text) }}</p>
      </div>

      <div class="mt-10 border-t border-line">
        <!-- the kilometre axis -->
        <div class="hidden lg:grid grid-cols-[15rem_minmax(0,1fr)_25rem] gap-x-8 py-2 mono text-quiet" aria-hidden="true">
          <span>{{ words.track }}</span>
          <span class="relative block h-4">
            <span class="absolute left-0">0 km</span>
            <span v-for="t in ticks" :key="t.km" class="absolute" :style="{ left: `${t.left}%` }">{{ t.km }}</span>
            <span class="absolute right-0">{{ Math.round(scale.kmMax) }}</span>
          </span>
          <span class="grid grid-cols-4 gap-x-4"><span>{{ words.elevation }}</span><span>{{ words.start }}</span><span>{{ words.fee }}</span><span>{{ words.free }}</span></span>
        </div>

        <article
          v-for="(track, i) in tracks" :key="track.id" :data-track="track.id"
          class="grid lg:grid-cols-[15rem_minmax(0,1fr)_25rem] gap-x-8 gap-y-5 py-6 items-center" :class="i === tracks.length - 1 ? 'border-y border-line' : 'border-t border-line'"
        >
          <div>
            <p class="flex items-baseline gap-2"><span class="led text-[4rem]">{{ track.figure }}</span><span class="mono text-quiet">{{ track.figureNote || 'km' }}</span></p>
            <h3 class="text-2xl font-extrabold tracking-[-0.03em] mt-1">{{ track.name }}</h3>
            <p v-if="track.description" class="text-quiet text-[0.95rem] mt-1 leading-snug">{{ tidyText(track.description) }}</p>
          </div>
          <div class="kmgrid relative h-24" :style="{ backgroundSize: `${(6 / scale.kmMax) * 100}% 100%` }" aria-hidden="true">
            <svg v-if="drawings[i]" viewBox="0 0 1000 100" preserveAspectRatio="none" class="absolute left-0 top-0 h-full" :style="{ width: `${drawings[i]!.width}%` }">
              <path :d="drawings[i]!.area" fill="var(--led)" fill-opacity=".14" />
              <path :d="drawings[i]!.line" fill="none" stroke="var(--led)" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
            <template v-if="drawings[i]">
              <span
                v-for="(p, j) in drawings[i]!.peaks" :key="j" class="absolute mono !text-[0.65rem]"
                :class="[p.main ? 'text-text' : 'text-quiet', p.wordOnly ? '' : '-translate-x-1/2']" :style="{ left: `${p.left}%`, top: `${p.top}%` }"
              >{{ p.text }}</span>
            </template>
          </div>
          <dl class="grid grid-cols-4 gap-x-4 items-start">
            <div><dt class="mono text-quiet lg:hidden">{{ words.elevation }}</dt><dd class="font-mono text-lg whitespace-nowrap">{{ track.elevation }}</dd></div>
            <div><dt class="mono text-quiet lg:hidden">{{ words.start }}</dt><dd class="font-mono text-lg">{{ track.startTime }}</dd></div>
            <div><dt class="mono text-quiet lg:hidden">{{ words.fee }}</dt><dd class="font-mono text-lg">{{ priceIn(track, fees.current.value) != null ? `${priceIn(track, fees.current.value)} ${words.crowns}` : '' }}</dd></div>
            <div>
              <dt class="mono text-quiet lg:hidden">{{ words.free }}</dt>
              <dd class="font-mono text-lg"><span class="text-led">{{ track.free }}</span><span class="text-quiet">/{{ track.capacity }}</span><span class="meter mt-1.5" :style="{ '--p': takenPercent(track) }" /></dd>
            </div>
            <dd v-if="registerUrl(track)" class="col-span-4 mt-3">
              <a :href="registerUrl(track)!" class="ulink mono" data-register>{{ track.registerLabel || words.signUp }} <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" /></a>
            </dd>
          </dl>
        </article>
      </div>
      <p v-if="block.links.length" class="mt-5 mono text-quiet flex flex-wrap gap-x-6 gap-y-1">
        <a v-for="l in block.links" :key="l.id" :href="siteHref(l.url)" class="ulink" :target="isExternal(l.url) ? '_blank' : undefined" :rel="isExternal(l.url) ? 'noopener' : undefined">{{ l.label }}</a>
      </p>
    </div>
  </section>
</template>
