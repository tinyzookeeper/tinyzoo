<script setup lang="ts">
// Soutisk's venue: the plan as flat coloured shapes beside the numbered legend. A plan uploaded
// in the block replaces the sample drawing; the numbers then lie over it.
import type { VenuePoint } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'venue'>; first?: boolean; anchor?: string; points: VenuePoint[] }>()
const { settings, words } = await useEvent()
const placed = computed(() => props.points.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => p.x != null && p.y != null).map((p) => ({ ...p, x: Number(p.x), y: Number(p.y) })))
const hasPlan = computed(() => !!props.block.plan || props.block.samplePlan)
</script>

<template>
  <section :id="anchor" class="bg-paper pb-24 sm:pb-36" :class="first ? 'pt-10' : ''">
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-9 items-center">
      <div :class="hasPlan ? 'lg:col-span-5' : 'lg:col-span-12'">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 text-lg text-quiet">{{ tidyText(block.text) }}</p>
        <ol v-if="points.length" class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6" :class="hasPlan ? 'lg:grid-cols-1' : 'lg:grid-cols-3'">
          <li v-for="(p, i) in points" :key="p.id" class="flex items-center gap-4 py-2.5">
            <span class="disp flex-none inline-flex items-center justify-center w-9 h-9 rounded-full bg-ink text-paper text-base">{{ i + 1 }}</span>
            <span><span class="font-bold">{{ p.name }}</span> <span v-if="p.note" class="text-quiet">{{ p.note }}</span></span>
          </li>
        </ol>
        <p v-if="settings?.address" class="mt-5 font-medium">{{ settings.address }}</p>
        <a v-if="settings?.mapUrl && block.linkLabel" :href="settings.mapUrl" target="_blank" rel="noopener" class="ulink">{{ block.linkLabel }} <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" /></a>
      </div>
      <div v-if="hasPlan" class="lg:col-span-7 rounded-[28px] overflow-hidden bg-paper2">
        <div v-if="block.plan" class="relative">
          <CmsImage :media="block.plan" sizes="(min-width: 1024px) 46rem, 100vw" class="block w-full h-auto" />
          <span v-for="p in placed" :key="p.id" class="disp absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-ink text-paper text-base" :style="{ left: `${p.x}%`, top: `${p.y}%` }">{{ p.n }}</span>
        </div>
        <svg v-else viewBox="0 0 640 470" class="block w-full h-auto" role="img" :aria-label="words.plan.aria">
          <path class="pl-forest" d="M0 0H640V118C560 150 500 96 420 118C340 140 300 100 220 124C140 148 80 110 0 140Z" />
          <path class="pl-meadow" d="M64 200Q60 192 72 196L240 182Q250 182 250 192L258 282Q258 292 248 292L80 306Q70 306 70 296Z" />
          <path class="pl-water" d="M36 362C36 342 66 332 98 334S152 346 150 364S122 392 90 392S36 382 36 362Z" />
          <path class="pl-road" d="M-10 428C120 408 260 436 380 416S560 386 650 398" />
          <path class="pl-lane" d="M300 420C300 380 298 350 300 316M300 330C286 322 270 312 256 300" />
          <g class="pl-house"><rect x="120" y="440" width="22" height="16" rx="3" /><rect x="168" y="446" width="26" height="15" rx="3" /><rect x="232" y="448" width="20" height="16" rx="3" /><rect x="330" y="436" width="24" height="16" rx="3" /><rect x="398" y="430" width="20" height="16" rx="3" /><rect x="452" y="420" width="26" height="15" rx="3" /><rect x="520" y="412" width="20" height="16" rx="3" /><rect x="580" y="408" width="24" height="15" rx="3" /><rect x="230" y="394" width="22" height="14" rx="3" /><rect x="340" y="386" width="20" height="14" rx="3" /><rect x="430" y="382" width="22" height="14" rx="3" /><rect x="540" y="372" width="20" height="14" rx="3" /></g>
          <rect class="pl-hall" x="300" y="238" width="96" height="60" rx="8" />
          <rect class="pl-pitch" x="430" y="170" width="184" height="114" rx="14" />
          <path class="pl-pitch-line" d="M522 170V284" /><circle class="pl-pitch-line" cx="522" cy="227" r="17" />
          <g class="pl-tent"><circle cx="446" cy="307" r="10" /><circle cx="472" cy="307" r="10" /><circle cx="498" cy="307" r="10" /><circle cx="575" cy="305" r="9" /></g>
          <path class="pl-route" d="M452 220C440 180 404 150 384 112S352 40 344 -4" />
          <path class="pl-route" d="M566 -4C570 48 544 100 524 138S480 186 462 214" />
          <text class="pl-txt" x="66" y="414">{{ words.plan.pond }}</text>
          <text class="pl-txt" x="360" y="80" style="fill:var(--paper)">{{ words.plan.toTrack }}</text>
          <text class="pl-txt" x="582" y="80" style="fill:var(--paper)">{{ words.plan.fromTrack }}</text>
          <text class="pl-txt" x="510" y="452">{{ words.plan.town }}</text>
          <g v-for="p in placed" :key="p.id"><circle class="pl-dot" :cx="p.x * 6.4" :cy="p.y * 4.7" r="17" :style="p.n === 2 ? 'fill:var(--paper)' : undefined" /><text class="pl-dot-t" :x="p.x * 6.4" :y="p.y * 4.7 + 7" :style="p.n === 2 ? 'fill:var(--ink)' : undefined">{{ p.n }}</text></g>
        </svg>
      </div>
    </div>
  </section>
</template>
