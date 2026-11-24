<script setup lang="ts">
// Zdivo's "under construction": a card for each running site with a row of small bricks, one for
// each week of the build, laid in the colour of the site as far as the build has got (the week
// it is in is counted from its start, so it is worked out in the browser; the server draws the
// whole row unlaid), the stage it is in and the handover date from the contract.
import type { Project } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'building'>; first?: boolean; anchor?: string; items: Project[] }>()
const words = useSiteWords()
const now = useNow()
const today = computed(() => (now.value == null ? '' : formatDate(new Date(now.value).toISOString())))
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 pt-20 lg:pt-28">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2" :class="block.eyebrow ? 'mt-2' : ''"><KitMarked :text="block.heading" as="span" /></component>
      </div>
      <p class="max-w-[26em] leading-[1.5]">{{ [block.text, today ? `${words.stateOn} ${today}` : '', words.sites(items.length)].filter(Boolean).join(' · ') }}</p>
    </div>
    <div class="mt-10 flex flex-col gap-2">
      <article v-for="p in items" :key="p.id" class="grid gap-2 lg:grid-cols-12" data-building>
        <div class="brick t1 !justify-between !p-6 lg:col-span-3">
          <h3 class="font-display text-[28px] font-extrabold leading-none"><NuxtLink :to="`/realizace/${p.slug}`" class="hover:underline">{{ tidyText(p.name) }}</NuxtLink></h3>
          <p class="mt-6 font-semibold">{{ [words.kinds[p.kind].one, p.area ? `${p.area} m²` : ''].filter(Boolean).join(' · ') }}</p>
        </div>
        <div class="rounded-[4px] bg-card p-6 lg:col-span-9">
          <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p class="font-display text-[24px] font-bold leading-none text-ink">{{ p.weeks ? (weekOf(p, now) ? words.weekOf(weekOf(p, now)!, p.weeks) : words.weeks(p.weeks)) : '' }}</p>
            <p v-if="p.currentStage" class="font-semibold text-brand">{{ p.currentStage }}</p>
          </div>
          <div v-if="p.weeks" class="mt-4 flex flex-wrap gap-[3px]" aria-hidden="true">
            <span v-for="w in p.weeks" :key="w" class="block h-[14px] w-[calc((100%-3px*19)/20)] rounded-[2px] transition-colors duration-500" :class="(weekOf(p, now) ?? 0) >= w ? 'bg-brand' : 'bg-brand-3/60'" />
          </div>
          <p v-if="p.handoverDate" class="mt-4 text-[15px]"><span class="text-quiet">{{ words.handoverByContract }}</span> <span class="font-semibold text-ink">{{ formatDate(p.handoverDate) }}</span></p>
        </div>
      </article>
    </div>
  </section>
</template>
