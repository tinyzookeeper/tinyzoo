<script setup lang="ts">
// Časomíra's venue: the plan as a dark schematic with the numbered points lit, and the legend
// beside it. A plan uploaded in the block replaces the sample drawing; the numbers then lie over it.
import type { VenuePoint } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'venue'>; first?: boolean; anchor?: string; points: VenuePoint[] }>()
const { settings, words } = await useEvent()
const placed = computed(() => props.points.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => p.x != null && p.y != null).map((p) => ({ ...p, x: Number(p.x), y: Number(p.y) })))
const hasPlan = computed(() => !!props.block.plan || props.block.samplePlan)
</script>

<template>
  <section :id="anchor" class="border-t border-line py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap">
      <div class="grid lg:grid-cols-12 gap-x-8 gap-y-4 items-end">
        <div class="lg:col-span-8">
          <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
        </div>
        <p v-if="block.text" class="lg:col-span-4 text-quiet">{{ tidyText(block.text) }}</p>
      </div>
      <div class="mt-10 grid lg:grid-cols-12 gap-x-10 gap-y-8 items-start">
        <div v-if="hasPlan" class="lg:col-span-8 panel overflow-hidden">
          <div v-if="block.plan" class="relative">
            <CmsImage :media="block.plan" sizes="(min-width: 1024px) 52rem, 100vw" class="block w-full h-auto" />
            <span v-for="p in placed" :key="p.id" class="absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-[2px] bg-led text-led-ink font-mono text-sm" :style="{ left: `${p.x}%`, top: `${p.y}%` }">{{ p.n }}</span>
          </div>
          <svg v-else viewBox="0 0 640 470" class="block w-full h-auto" role="img" :aria-label="words.plan.aria">
            <path class="pl-forest" d="M0 0H640V118C560 150 500 96 420 118C340 140 300 100 220 124C140 148 80 110 0 140Z" />
            <path class="pl-contour" d="M0 96C90 70 170 104 260 82S430 60 520 76S600 70 640 60" />
            <path class="pl-contour" d="M0 58C100 34 190 66 290 44S450 24 540 38S610 34 640 26" />
            <path class="pl-contour" d="M60 0C150 22 230 30 330 10M420 0C480 12 540 8 600 0" />
            <path class="pl-contour" d="M0 190C60 176 120 170 200 168M400 150C470 146 560 150 640 138" />
            <path class="pl-meadow" d="M64 200L246 184L256 290L72 306Z" />
            <path class="pl-water" d="M36 362C36 342 66 332 98 334S152 346 150 364S122 392 90 392S36 382 36 362Z" />
            <path class="pl-road" d="M-10 428C120 408 260 436 380 416S560 386 650 398" />
            <path class="pl-lane" d="M300 420C300 380 298 350 300 316M300 330C286 322 270 312 256 300" />
            <g class="pl-house"><rect x="120" y="440" width="22" height="16" /><rect x="168" y="446" width="26" height="15" /><rect x="232" y="448" width="20" height="16" /><rect x="330" y="436" width="24" height="16" /><rect x="398" y="430" width="20" height="16" /><rect x="452" y="420" width="26" height="15" /><rect x="520" y="412" width="20" height="16" /><rect x="580" y="408" width="24" height="15" /><rect x="230" y="394" width="22" height="14" /><rect x="340" y="386" width="20" height="14" /><rect x="430" y="382" width="22" height="14" /><rect x="540" y="372" width="20" height="14" /></g>
            <rect class="pl-hall" x="300" y="238" width="96" height="60" />
            <rect class="pl-pitch" x="430" y="170" width="184" height="114" rx="3" />
            <path class="pl-pitch" d="M522 170V284" /><circle class="pl-pitch" cx="522" cy="227" r="17" />
            <g class="pl-tent"><rect x="436" y="298" width="20" height="18" /><rect x="462" y="298" width="20" height="18" /><rect x="488" y="298" width="20" height="18" /><rect x="566" y="296" width="18" height="18" /></g>
            <path class="pl-route" d="M452 220C440 180 404 150 384 112S352 40 344 -4" />
            <path class="pl-route" d="M566 -4C570 48 544 100 524 138S480 186 462 214" />
            <text class="pl-txt" x="262" y="62">{{ words.plan.toTrack }}</text>
            <text class="pl-txt" x="578" y="62">{{ words.plan.finish }}</text>
            <text class="pl-txt" x="84" y="330">{{ words.plan.meadow }}</text>
            <text class="pl-txt" x="66" y="412">{{ words.plan.pond }}</text>
            <text class="pl-txt" x="500" y="452">{{ words.plan.town }}</text>
            <g v-for="p in placed" :key="p.id"><rect class="pl-dot" :x="p.x * 6.4 - 16" :y="p.y * 4.7 - 16" width="32" height="32" rx="2" /><text class="pl-dot-t" :x="p.x * 6.4" :y="p.y * 4.7 + 6.5">{{ p.n }}</text></g>
            <g transform="translate(36 28)"><path d="M0 0H80M0 -5V5M80 -5V5" stroke="var(--quiet)" stroke-width="1.5" fill="none" /><text x="90" y="4" class="pl-txt">{{ words.plan.scale }}</text></g>
            <g transform="translate(606 34)"><path d="M0 -16L6 4L0 0L-6 4Z" fill="var(--quiet)" /><text x="0" y="20" text-anchor="middle" class="pl-txt">{{ words.plan.north }}</text></g>
          </svg>
        </div>
        <div :class="hasPlan ? 'lg:col-span-4' : 'lg:col-span-12'">
          <ol v-if="points.length" class="border-t border-line">
            <li v-for="(p, i) in points" :key="p.id" class="grid grid-cols-[2.75rem_1fr] items-center py-3 border-b border-line">
              <span class="inline-flex items-center justify-center w-7 h-7 rounded-[2px] bg-led text-led-ink font-mono text-sm">{{ i + 1 }}</span>
              <span><span class="font-bold">{{ p.name }}</span><span v-if="p.note" class="block text-quiet text-[0.95rem]">{{ p.note }}</span></span>
            </li>
          </ol>
          <p v-if="settings?.address" class="mt-6">{{ settings.address }}</p>
          <p v-if="settings?.coordinates" class="font-mono text-quiet text-[0.95rem]">{{ settings.coordinates }}</p>
          <a v-if="settings?.mapUrl && block.linkLabel" :href="settings.mapUrl" target="_blank" rel="noopener" class="ulink mono mt-2">{{ block.linkLabel }} <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" /></a>
        </div>
      </div>
    </div>
  </section>
</template>
