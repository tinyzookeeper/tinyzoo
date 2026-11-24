<script setup lang="ts">
// Kontrolky's people: a portrait, the name, the role in the brand colour, the years in the trade on
// an odometer and a few sentences.
import type { TeamMember } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; people: TeamMember[] }>()
const { words } = await useGarage()
// Three digits, the leading zeros dimmed: 7 → 0 0 7.
const digits = (years: number) => String(Math.min(years, 999)).padStart(3, '0').split('').map((d, i, all) => ({ d, dim: all.slice(0, i + 1).every((x) => x === '0') && i < all.length - 1 }))
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-28 scroll-mt-2">
    <div class="grid lg:grid-cols-12 gap-x-14 gap-y-5 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="cap">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 text-quiet">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-12 grid sm:grid-cols-3 gap-x-6 gap-y-12">
      <article v-for="p in people" :key="p.id">
        <CmsImage v-if="p.photo" :media="p.photo" sizes="(min-width: 640px) 26rem, 100vw" class="w-full aspect-[4/5] object-cover rounded-[18px]" />
        <h3 class="mt-6 text-[26px]">{{ p.name }}</h3>
        <p v-if="p.role" class="mt-1.5 text-[16px] text-brand">{{ p.role }}</p>
        <p v-if="p.years != null" class="mt-4 flex items-center gap-3 text-[15px] text-quiet">
          <span class="dig inline-flex gap-[3px] text-[20px] font-semibold text-text" aria-hidden="true"><span v-for="(x, i) in digits(p.years)" :key="i" class="w-7 h-9 grid place-items-center bg-panel rounded-[5px]" :class="x.dim ? 'text-quiet' : ''">{{ x.d }}</span></span>{{ words.yearsInTrade(p.years) }}
        </p>
        <p v-if="p.text" class="mt-4 text-[16px] text-quiet">{{ tidyText(p.text) }}</p>
      </article>
    </div>
  </section>
</template>
