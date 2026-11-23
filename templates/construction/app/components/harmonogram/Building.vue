<script setup lang="ts">
// Harmonogram's "under construction": a surface under the opening, each running site with a bar
// on its own week grid (the week it is in, counted from its start), its stage and the handover
// date from the contract. (Which week it is depends on today, so it is worked out in the
// browser; the server draws the planned length.)
import type { Project } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'building'>; first?: boolean; anchor?: string; items: Project[] }>()
const words = useSiteWords()
const now = useNow()
const today = computed(() => (now.value == null ? '' : numericDate(new Date(now.value).toISOString())))
const meta = (p: Project) => [words.value.kinds[p.kind].one, p.kind === 'new' ? systemWord(p, words.value) : '', p.area ? `${p.area} m²` : ''].filter(Boolean).join(' · ')
</script>

<template>
  <section :id="anchor" class="scroll-mt-20 border-y border-line bg-surface">
    <div class="wrap py-10 lg:py-12">
      <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p v-if="block.eyebrow" class="mono mb-2">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="text-[28px] font-extrabold tracking-[-.03em] text-text sm:text-[34px]"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
        </div>
        <p class="mono">{{ [today ? `${words.stateOn} ${today}` : '', words.sites(items.length)].filter(Boolean).join(' · ') }}</p>
      </div>
      <p v-if="block.text" class="mt-4 max-w-[36em] leading-[1.6] text-quiet">{{ tidyText(block.text) }}</p>
      <ul class="mt-6 border-t border-line">
        <li v-for="p in items" :key="p.id" class="grid gap-x-8 gap-y-3 border-b border-line py-5 lg:grid-cols-12 lg:items-center" data-building>
          <div class="lg:col-span-3"><h3 class="text-[19px] font-bold tracking-[-.01em] text-text"><NuxtLink :to="`/realizace/${p.slug}`" class="hover:text-brand">{{ tidyText(p.name) }}</NuxtLink></h3><p class="mono mt-1">{{ meta(p) }}</p></div>
          <div v-if="p.weeks" class="lg:col-span-6">
            <div class="track" :style="{ '--w': p.weeks }"><span class="bar" :style="{ '--d': weekOf(p, now) ?? 0 }" /></div>
            <p class="num mt-2 flex justify-between text-[13px] text-quiet"><span><span class="text-brand">{{ weekOf(p, now) ? words.weekNo(weekOf(p, now)!) : words.weeks(p.weeks) }}</span> {{ words.ofTotal(p.weeks) }}</span><span>{{ p.currentStage }}</span></p>
          </div>
          <p v-if="p.handoverDate" class="lg:col-span-3 lg:text-right"><span class="mono block">{{ words.handoverByContract }}</span><span class="num mt-1 block text-[19px] font-medium text-text">{{ numericDate(p.handoverDate) }}</span></p>
        </li>
      </ul>
    </div>
  </section>
</template>
