<script setup lang="ts">
// Tabule's prices: four boxes in one black frame; the highlighted price is filled in the colour
// of the site and rises above and below the others on a desktop.
import type { Tariff } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'prices'>; first?: boolean; anchor?: string; tariffs: Tariff[] }>()
const n = computed(() => props.tariffs.length)
// The rules between boxes, for a phone (one column), a tablet (two) and a desktop (four): a box is
// ruled on its right unless it ends its row, and below unless it is in the last row.
const rules = (i: number) => [
  i < n.value - 1 ? 'border-b-2' : '',
  Math.floor(i / 2) < Math.floor((n.value - 1) / 2) ? 'sm:border-b-2' : 'sm:border-b-0',
  i % 2 === 0 && i < n.value - 1 ? 'sm:border-r-2' : 'sm:border-r-0',
  'lg:border-b-0',
  i % 4 !== 3 && i < n.value - 1 ? 'lg:border-r-2' : 'lg:border-r-0',
].join(' ')
const priceSize = 'text-[2.6rem] lg:text-[2.2rem] xl:text-[2.75rem]'
</script>

<template>
  <section :id="anchor" class="on-light wrap py-16 lg:py-24">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="max-w-[26rem] lg:pb-3">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 border-2 border-ink">
      <template v-for="(t, i) in tariffs" :key="t.id">
        <div v-if="t.featured" class="on-brand flex flex-col p-6 lg:p-7 bg-brand text-brand-ink border-ink lg:-my-5 lg:py-12 lg:outline-2 lg:outline-ink" :class="rules(i)">
          <h3 class="mono flex flex-wrap justify-between gap-2"><span>{{ tidyText(t.name) }}</span><span v-if="t.badge" class="px-2 bg-accent text-accent-ink">{{ t.badge }}</span></h3>
          <p class="display mt-6 leading-none whitespace-nowrap" :class="priceSize">{{ formatPrice(t.price) }} <span class="text-[1.05rem] tracking-normal">Kč</span></p>
          <p class="mt-5">{{ tidyText(t.text) }}</p>
          <div v-if="t.linkLabel && t.linkUrl" class="mt-auto pt-6"><NuxtLink class="btn w-full" :to="siteHref(t.linkUrl)">{{ t.linkLabel }}</NuxtLink></div>
        </div>
        <div v-else class="flex flex-col p-6 lg:p-7 border-ink" :class="rules(i)">
          <h3 class="mono">{{ tidyText(t.name) }}</h3>
          <p class="display mt-6 leading-none whitespace-nowrap" :class="priceSize">{{ formatPrice(t.price) }} <span class="text-[1.05rem] tracking-normal">Kč</span></p>
          <p class="mt-5">{{ tidyText(t.text) }}</p>
          <NuxtLink v-if="t.linkLabel && t.linkUrl" class="ulink mono mt-auto pt-3 self-start" :to="siteHref(t.linkUrl)">{{ t.linkLabel }}</NuxtLink>
        </div>
      </template>
    </div>
    <p v-if="block.footnote" class="mt-8 lg:mt-12 max-w-[48rem] krow-muted">{{ tidyText(block.footnote) }}</p>
  </section>
</template>
