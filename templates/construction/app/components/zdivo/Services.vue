<script setup lang="ts">
// Zdivo's services: five courses of two bricks. A clay brick with the name and the price, a card
// with what the work is and what is and is not in the price; the clay brick changes sides from
// row to row.
import type { Service } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-24 pt-20 lg:pt-28">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 max-w-[11em]" :class="block.eyebrow ? 'mt-2' : ''"><KitMarked :text="block.heading" as="span" /></component>
      </div>
      <p v-if="block.text" class="max-w-[26em] leading-[1.5]">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-10 flex flex-col gap-2">
      <article v-for="(s, i) in items" :key="s.id" class="grid gap-2 lg:grid-cols-12" data-service>
        <div class="brick !justify-between !p-6 lg:col-span-3" :class="[brickTone(i), i % 2 ? 'lg:order-2' : '']">
          <h3 class="font-display text-[34px] font-extrabold leading-none">{{ s.name }}</h3>
          <p v-if="s.price || s.unit" class="mt-6 font-semibold">{{ [s.price, s.unit].filter(Boolean).join(' ') }}</p>
        </div>
        <div class="grid gap-x-8 gap-y-5 rounded-[4px] bg-card p-6 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-[1.1fr_1fr_1fr]">
          <p class="leading-[1.5] sm:col-span-2 lg:col-span-1">{{ tidyText(s.text) }}</p>
          <div>
            <p class="text-[14px] font-bold text-ink">{{ words.included }}</p>
            <ul class="mt-1.5 space-y-1 text-[16px] text-ink"><li v-for="(it, j) in s.included" :key="j" class="flex gap-2.5"><UIcon name="i-lucide-check" class="mt-[3px] size-[18px] flex-none text-brand" aria-hidden="true" />{{ it.text }}</li></ul>
          </div>
          <div v-if="s.excluded.length">
            <p class="text-[14px] font-bold text-ink">{{ words.excluded }}</p>
            <ul class="mt-1.5 space-y-1 text-[16px] text-quiet"><li v-for="(it, j) in s.excluded" :key="j" class="flex gap-2.5"><UIcon name="i-lucide-minus" class="mt-[3px] size-[18px] flex-none" aria-hidden="true" />{{ it.text }}</li></ul>
          </div>
        </div>
      </article>
    </div>
    <p v-if="block.note" class="mt-4 text-[15px] text-quiet">{{ tidyText(block.note) }}</p>
  </section>
</template>
