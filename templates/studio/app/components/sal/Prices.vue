<script setup lang="ts">
// Sál's prices: four ruled columns on a desktop, white cards below it. The highlighted price is
// filled in the colour of the site and stands out a little above and below the others.
import type { Tariff } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'prices'>; first?: boolean; anchor?: string; tariffs: Tariff[] }>()
const { words } = await useStudio()
// A column is closed with a rule on its right, unless it is the last or the highlighted one is next to it.
const ruled = (i: number) => i < props.tariffs.length - 1 && !props.tariffs[i]!.featured && !props.tariffs[i + 1]!.featured
</script>

<template>
  <section :id="anchor" class="wrap py-20 md:py-28">
    <div class="grid lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 lg:pt-10 text-[1.05rem]">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-0 lg:border-y lg:border-line">
      <template v-for="(t, i) in tariffs" :key="t.id">
        <div v-if="t.featured" class="flex flex-col p-7 rounded-[1.75rem] bg-brand text-brand-ink lg:-my-4 lg:py-11">
          <p v-if="t.badge" class="self-start px-3 py-1 rounded-full bg-brand-ink/15 text-[0.75rem] font-semibold tracking-[0.1em] uppercase">{{ t.badge }}</p>
          <h3 class="text-[1.5rem] leading-tight !text-brand-ink" :class="t.badge ? 'mt-4' : ''">{{ tidyText(t.name) }}</h3>
          <p class="mt-5 font-display text-[3rem] leading-none"><template v-if="t.price === 0">{{ words.free }}</template><template v-else>{{ formatPrice(t.price) }} <span class="text-[1.5rem]">Kč</span></template></p>
          <p class="mt-5 text-[0.975rem]">{{ tidyText(t.text) }}</p>
          <div v-if="t.linkLabel && t.linkUrl" class="mt-auto pt-6"><NuxtLink class="btn btn-light w-full" :to="siteHref(t.linkUrl)">{{ t.linkLabel }}</NuxtLink></div>
        </div>
        <div v-else class="flex flex-col p-7 rounded-[1.75rem] lg:rounded-none bg-card lg:bg-transparent" :class="ruled(i) ? 'lg:border-r lg:border-line' : ''">
          <h3 class="text-[1.5rem] leading-tight">{{ tidyText(t.name) }}</h3>
          <p class="mt-5 font-display text-[3rem] leading-none text-ink"><template v-if="t.price === 0">{{ words.free }}</template><template v-else>{{ formatPrice(t.price) }} <span class="text-[1.5rem]">Kč</span></template></p>
          <p class="mt-5 text-[0.975rem]">{{ tidyText(t.text) }}</p>
          <div v-if="t.linkLabel && t.linkUrl" class="mt-auto pt-3"><NuxtLink class="tlink" :to="siteHref(t.linkUrl)">{{ t.linkLabel }}</NuxtLink></div>
        </div>
      </template>
    </div>
    <p v-if="block.footnote" class="mt-8 lg:mt-10 max-w-[46rem] text-[0.95rem] text-quiet">{{ tidyText(block.footnote) }}</p>
  </section>
</template>
