<script setup lang="ts">
// Deka's prices: four soft cards; the highlighted one is dark with a strip of the blanket on top
// and rises above and below the others on a desktop.
import type { Tariff } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'prices'>; first?: boolean; anchor?: string; tariffs: Tariff[] }>()
const { words } = await useStudio()
</script>

<template>
  <section :id="anchor" class="wrap pb-16 md:pb-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end pt-12 md:pt-16 border-t-[1.5px] border-ink">
      <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-7"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="lg:col-span-5">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 items-stretch">
      <template v-for="t in tariffs" :key="t.id">
        <div v-if="t.featured" class="on-dark relative flex flex-col rounded-md bg-ink text-paper overflow-hidden lg:-my-4">
          <div class="stripes !h-[14px]" aria-hidden="true" />
          <div class="flex flex-col flex-1 p-6 lg:pt-7 lg:pb-8">
            <p v-if="t.badge" class="self-start px-3 py-1 rounded-full bg-brand text-brand-ink text-[0.8rem] font-bold">{{ t.badge }}</p>
            <h3 class="text-[1.3rem] leading-tight !text-paper" :class="t.badge ? 'mt-3' : ''">{{ tidyText(t.name) }}</h3>
            <p class="mt-5 font-display font-bold text-[2.9rem] leading-none"><template v-if="t.price === 0">{{ words.free }}</template><template v-else>{{ formatPrice(t.price) }} <span class="text-[1.4rem]">Kč</span></template></p>
            <p class="mt-4 text-[0.975rem] opacity-90">{{ tidyText(t.text) }}</p>
            <div v-if="t.linkLabel && t.linkUrl" class="mt-auto pt-6"><NuxtLink class="btn btn-brand w-full" :to="siteHref(t.linkUrl)">{{ t.linkLabel }}</NuxtLink></div>
          </div>
        </div>
        <div v-else class="flex flex-col p-6 rounded-md bg-card">
          <h3 class="text-[1.3rem] leading-tight">{{ tidyText(t.name) }}</h3>
          <p class="mt-5 font-display font-bold text-[2.9rem] leading-none text-ink"><template v-if="t.price === 0">{{ words.free }}</template><template v-else>{{ formatPrice(t.price) }} <span class="text-[1.4rem]">Kč</span></template></p>
          <p class="mt-4 text-[0.975rem]">{{ tidyText(t.text) }}</p>
          <NuxtLink v-if="t.linkLabel && t.linkUrl" class="tlink mt-auto pt-3 self-start" :to="siteHref(t.linkUrl)">{{ t.linkLabel }}</NuxtLink>
        </div>
      </template>
    </div>
    <p v-if="block.footnote" class="mt-8 lg:mt-12 max-w-[46rem] text-[0.95rem] text-quiet">{{ tidyText(block.footnote) }}</p>
  </section>
</template>
