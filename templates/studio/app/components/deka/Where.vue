<script setup lang="ts">
// Deka's "where": a soft frame holding a drawn plan (the river, the bridge, the way on foot, the
// bus stop and the parking) and beside it the address and the ways of getting there.
defineProps<{ block: BlockOf<'where'>; first?: boolean; anchor?: string }>()
const { settings, name, words } = await useStudio()
</script>

<template>
  <section :id="anchor" class="wrap pt-14 md:pt-20 pb-16 md:pb-24">
    <div class="grid lg:grid-cols-12 gap-2 p-2 rounded-md bg-card">
      <div class="lg:col-span-7 flex items-center rounded-[4px] bg-paper overflow-hidden">
        <svg viewBox="0 0 440 300" class="block w-full h-auto" role="img" :aria-label="words.planLabel(name, block.routeFrom, block.routeVia)" style="font-family: var(--font-sans)" fill="none">
          <!-- the river -->
          <path d="M-10 250 C 70 232, 120 196, 176 172 S 300 96, 450 62" stroke="var(--k2)" stroke-width="44" stroke-linecap="round" />
          <path d="M-10 250 C 70 232, 120 196, 176 172 S 300 96, 450 62" stroke="var(--paper)" stroke-width="1.5" stroke-dasharray="2 9" stroke-linecap="round" opacity=".9" />
          <text v-if="block.river" x="318" y="110" font-size="12" font-style="italic" fill="var(--ink)" opacity=".75" transform="rotate(-27 318 110)">{{ block.river }}</text>
          <!-- the square -->
          <rect x="316" y="206" width="62" height="46" rx="3" stroke="var(--ink)" stroke-width="1.5" />
          <text v-if="block.routeFrom" x="347" y="272" font-size="12.5" font-weight="600" fill="var(--ink)" text-anchor="middle">{{ block.routeFrom }}</text>
          <!-- the bridge -->
          <path d="M228 190 L 180 128" stroke="var(--ink)" stroke-width="9" stroke-linecap="butt" />
          <text v-if="block.routeVia" x="240" y="170" font-size="12.5" font-weight="600" fill="var(--ink)">{{ block.routeVia }}</text>
          <!-- the way on foot -->
          <path d="M316 229 C 280 226, 252 214, 228 190 L 180 128 C 150 112, 118 100, 96 96" stroke="var(--ink)" stroke-width="2" stroke-dasharray="7 6" stroke-linecap="round" />
          <text v-if="block.routeFromTime" x="262" y="244" font-size="11.5" fill="var(--ink)">{{ block.routeFromTime }}</text>
          <text v-if="block.routeViaTime" x="150" y="102" font-size="11.5" fill="var(--ink)">{{ block.routeViaTime }}</text>
          <!-- the studio -->
          <g transform="translate(40 52)">
            <rect x="0" y="12" width="66" height="44" rx="2" fill="var(--ink)" />
            <path d="M0 12 L 16 0 L 16 12 L 32 0 L 32 12 L 48 0 L 48 12 L 66 12 Z" fill="var(--ink)" />
            <g fill="var(--brand)"><rect x="8" y="22" width="9" height="13" /><rect x="22" y="22" width="9" height="13" /><rect x="36" y="22" width="9" height="13" /><rect x="50" y="22" width="9" height="13" /></g>
          </g>
          <text x="40" y="126" font-size="15" font-weight="700" fill="var(--ink)" style="font-family: var(--font-display)">{{ name }}</text>
          <text v-if="settings?.street" x="40" y="142" font-size="11.5" fill="var(--ink)">{{ settings.street }}</text>
          <!-- the parking and the stop -->
          <g transform="translate(116 60)"><rect width="22" height="22" rx="3" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5" /><text x="11" y="16" font-size="13" font-weight="700" fill="var(--ink)" text-anchor="middle">P</text></g>
          <text v-if="block.parking" x="144" y="75" font-size="11.5" fill="var(--ink)">{{ block.parking }}</text>
          <g transform="translate(60 176)"><circle cx="9" cy="9" r="9" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5" /><circle cx="9" cy="9" r="3.5" fill="var(--ink)" /></g>
          <path d="M69 176 L 72 150" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="2 4" />
          <text v-if="block.stop" x="60" y="210" font-size="11.5" fill="var(--ink)">{{ block.stop }}</text>
          <text v-if="block.stopNote" x="60" y="224" font-size="11.5" fill="var(--ink)">{{ block.stopNote }}</text>
        </svg>
      </div>
      <div class="lg:col-span-5 p-5 md:p-8 self-center">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 font-display font-bold text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.1] text-ink"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-2">{{ tidyText(block.text) }}</p>
        <dl v-if="block.ways.length" class="mt-5 text-[0.95rem] leading-normal">
          <div v-for="(w, i) in block.ways" :key="w.id" class="grid grid-cols-[5.75rem_1fr] gap-3 py-2.5 border-[var(--rule)]" :class="i === block.ways.length - 1 ? 'border-y' : 'border-t'"><dt class="font-semibold text-ink">{{ w.label }}</dt><dd>{{ tidyText(w.text) }}</dd></div>
        </dl>
        <a v-if="settings?.mapUrl" class="tlink mt-4" :href="settings.mapUrl" target="_blank" rel="noopener">{{ words.openMap }} <UIcon name="i-lucide-arrow-up-right" class="size-[1em]" aria-hidden="true" /></a>
      </div>
    </div>
  </section>
</template>
