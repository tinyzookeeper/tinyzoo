<script setup lang="ts">
// Výkres's "under construction": a ruled list, each build with a dimension line that reads the
// week it is in, and the handover date from the contract. (Which week it is depends on today,
// so it is worked out in the browser; the server draws the planned length.)
import type { Project } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'building'>; first?: boolean; anchor?: string; items: Project[] }>()
const words = useSiteWords()
const now = useNow()
const today = computed(() => (now.value == null ? '' : formatDate(new Date(now.value).toISOString())))
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 pt-20 lg:pt-28">
    <div class="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
      <div>
        <p v-if="block.eyebrow" class="lab mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] font-light leading-tight tracking-[-.02em] text-ink sm:text-[42px]"><KitMarked :text="block.heading" as="span" /></component>
      </div>
      <p class="lab">{{ [today ? `${words.stateOn} ${today}` : '', words.sites(items.length)].filter(Boolean).join(' · ') }}</p>
    </div>
    <p v-if="block.text" class="mt-6 max-w-[36em] leading-[1.65]">{{ tidyText(block.text) }}</p>
    <ul>
      <li v-for="p in items" :key="p.id" class="grid gap-x-8 gap-y-4 border-b border-ink py-6 lg:grid-cols-12 lg:items-center" data-building>
        <div class="lg:col-span-4">
          <h3 class="font-display text-[22px] font-normal tracking-[-.01em] text-ink"><NuxtLink :to="`/realizace/${p.slug}`" class="hover:text-brand">{{ p.name }}</NuxtLink></h3>
          <p class="lab mt-1.5"><SupText :text="[words.kinds[p.kind].one, p.area ? `${p.area} m²` : ''].filter(Boolean).join(' · ')" /></p>
        </div>
        <div class="lg:col-span-5">
          <div class="kota"><span>{{ [p.weeks ? (weekOf(p, now) ? words.weekOf(weekOf(p, now)!, p.weeks) : words.weeks(p.weeks)) : '', p.currentStage].filter(Boolean).join(' · ') }}</span></div>
          <div v-if="p.weeks" class="mt-2 h-3 border border-ink"><div class="hatch-zdivo h-full transition-[width] duration-700" :style="{ width: `${((weekOf(p, now) ?? 0) / p.weeks) * 100}%` }" /></div>
        </div>
        <p v-if="p.handoverDate" class="lg:col-span-3 lg:text-right"><span class="lab block">{{ words.handoverByContract }}</span><span class="mt-1 block font-data text-[17px] font-medium text-ink">{{ formatDate(p.handoverDate) }}</span></p>
      </li>
    </ul>
  </section>
</template>
