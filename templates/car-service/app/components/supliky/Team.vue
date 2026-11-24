<script setup lang="ts">
// Šuplíky's people: a portrait with a stitched name patch, the full name, the role and the years in
// the trade in the brand colour, and a few sentences in the first person of the garage.
import type { TeamMember } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'team'>; first?: boolean; anchor?: string; people: TeamMember[] }>()
const { words } = await useGarage()
// (each patch hangs a little crooked, a different way)
const tilt = ['-rotate-3', 'rotate-2', '-rotate-2']
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-24 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="kicker text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[42px] sm:text-[60px]">{{ plainEmphasis(block.heading) }}</component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 text-[17px]">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 grid sm:grid-cols-3 gap-x-6 gap-y-12">
      <article v-for="(p, i) in people" :key="p.id">
        <div class="relative">
          <CmsImage v-if="p.photo" :media="p.photo" sizes="(min-width: 640px) 26rem, 100vw" class="w-full aspect-[4/5] object-cover rounded-[28px]" />
          <span class="patch absolute left-4 -bottom-4" :class="tilt[i % 3]">{{ p.name.split(' ')[0] }}</span>
        </div>
        <h3 class="mt-9 text-[27px]">{{ p.name }}</h3>
        <p v-if="p.role || p.years != null" class="mt-1.5 font-semibold text-brand">{{ [p.role, p.years != null ? words.yearsInTrade(p.years) : ''].filter(Boolean).join(' · ') }}</p>
        <p v-if="p.text" class="mt-2 text-[16px] text-quiet">{{ tidyText(p.text) }}</p>
      </article>
    </div>
  </section>
</template>
