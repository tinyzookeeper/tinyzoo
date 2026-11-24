<script setup lang="ts">
// Výkres's services: one ruled table. Each kind of work on its own row: what it is, what is in
// the price (filled squares), what is not (empty ones) and the price.
import type { Service } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 pt-20 lg:pt-28">
    <div class="grid gap-6 border-b-2 border-ink pb-6 lg:grid-cols-12 lg:items-end lg:gap-8">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="lab mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] font-light leading-tight tracking-[-.02em] text-ink sm:text-[42px]"><KitMarked :text="block.heading" as="span" /></component>
      </div>
      <p v-if="block.text" class="max-w-[36em] leading-[1.65] lg:col-span-6 lg:col-start-7">{{ tidyText(block.text) }}</p>
    </div>
    <div class="hidden grid-cols-12 gap-8 border-b border-ink py-3 lg:grid">
      <p class="lab col-span-4">{{ words.kindOfWork }}</p>
      <p class="lab col-span-3 flex items-center gap-2"><span class="inline-block h-2.5 w-2.5 bg-ink" />{{ words.included }}</p>
      <p class="lab col-span-3 flex items-center gap-2"><span class="inline-block h-2.5 w-2.5 border border-ink" />{{ words.excluded }}</p>
      <p class="lab col-span-2 text-right">{{ words.priceFrom }}</p>
    </div>

    <div v-for="(s, i) in items" :key="s.id" class="grid gap-x-8 gap-y-4 py-8 lg:grid-cols-12" :class="i === items.length - 1 ? 'border-b-2 border-ink' : 'border-b border-ink'" data-service>
      <div class="lg:col-span-4 lg:pr-6"><h3 class="font-display text-[24px] font-normal tracking-[-.01em] text-ink">{{ s.name }}</h3><p v-if="s.text" class="mt-2 text-[15px] leading-relaxed">{{ tidyText(s.text) }}</p></div>
      <div class="lg:col-span-3">
        <p class="lab mb-2 lg:hidden">{{ words.included }}</p>
        <ul class="space-y-1.5 text-[15px] text-ink"><li v-for="(it, j) in s.included" :key="j" class="flex gap-3"><span class="mt-[7px] h-2.5 w-2.5 flex-none bg-ink" />{{ it.text }}</li></ul>
      </div>
      <div class="lg:col-span-3">
        <template v-if="s.excluded.length">
          <p class="lab mb-2 mt-2 lg:hidden">{{ words.excluded }}</p>
          <ul class="space-y-1.5 text-[15px]"><li v-for="(it, j) in s.excluded" :key="j" class="flex gap-3"><span class="mt-[7px] h-2.5 w-2.5 flex-none border border-ink" />{{ it.text }}</li></ul>
        </template>
      </div>
      <p class="lg:col-span-2 lg:text-right"><span class="font-display text-[24px] font-light tracking-[-.02em] text-ink">{{ s.price }}</span><span v-if="s.unit" class="ml-2 font-data text-[14px] text-quiet lg:ml-0 lg:mt-1 lg:block"><SupText :text="s.unit" /></span></p>
    </div>
    <p v-if="block.note" class="mt-4 text-sm text-quiet">{{ tidyText(block.note) }}</p>
  </section>
</template>
