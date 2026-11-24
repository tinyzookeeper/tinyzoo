<script setup lang="ts">
// Dres's squad: a grid of tiles, each with the shirt number in huge capitals; a player with a
// photograph gets it under a dark gradient, and the coaching staff has a black tile of its own.
import type { Player } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'roster'>; first?: boolean; anchor?: string; players: Player[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 lg:pt-20">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-3 border-b-4 border-ink pb-4">
      <component :is="first ? 'h1' : 'h2'" class="wide text-[5.6vw] sm:text-[clamp(26px,3.6vw,48px)]">{{ plainEmphasis(block.heading) }}</component>
      <p v-if="block.season" class="cap pb-1">{{ block.season }}</p>
    </div>
    <ul class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <template v-for="p in players" :key="p.id">
        <li v-if="p.photo" class="relative aspect-[4/5] overflow-hidden bg-ink text-white">
          <CmsImage :media="p.photo" sizes="(min-width: 1024px) 14rem, 45vw" class="absolute inset-0 h-full w-full object-cover object-top" />
          <div class="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 to-transparent" aria-hidden="true" />
          <p v-if="p.number != null" class="wide absolute left-0 top-0 grid h-12 min-w-12 place-items-center bg-brand px-2 text-[22px] text-brand-ink">{{ p.number }}</p>
          <div class="absolute inset-x-0 bottom-0 p-3.5"><p class="head text-[17px]">{{ p.name }}</p><p class="cap mt-1 !text-[11px] text-white/85">{{ playerLine(p, words) }}</p></div>
        </li>
        <li v-else class="flex aspect-[4/5] flex-col justify-between bg-stone p-3.5">
          <p class="wide text-[clamp(44px,5vw,68px)]">{{ p.number }}</p>
          <div><p class="head text-[17px]">{{ p.name }}</p><p class="cap mt-1 !text-[11px] opacity-70">{{ playerLine(p, words) }}</p></div>
        </li>
      </template>
      <li v-if="block.staff.length" class="dark flex aspect-[4/5] flex-col justify-between bg-ink p-3.5 text-paper">
        <p class="cap text-paper/70">{{ words.staffHead }}</p>
        <div class="text-[15px] leading-snug">
          <template v-for="(s, i) in block.staff" :key="s.id"><p class="head text-[17px]">{{ s.name }}</p><p class="cap mt-1 !text-[11px] text-paper/70" :class="i < block.staff.length - 1 ? 'mb-3' : ''">{{ s.role }}</p></template>
        </div>
      </li>
    </ul>
  </section>
</template>
