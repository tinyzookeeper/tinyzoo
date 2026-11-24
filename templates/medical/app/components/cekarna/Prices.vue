<script setup lang="ts">
// Čekárna's price list: one soft panel with a photograph on the left and the prices as ruled rows.
import type { Service } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'prices'>; first?: boolean; items: Service[] }>()
const words = useSiteWords()
</script>

<template>
  <section class="wrap pt-16 lg:pt-24">
    <div class="rounded-[24px] lg:rounded-[28px] bg-tint p-6 sm:p-9 lg:p-12 grid gap-9 lg:gap-16 lg:grid-cols-[1fr_1.35fr]">
      <div class="flex flex-col">
        <component :is="first ? 'h1' : 'h2'" class="text-[1.9rem] lg:text-[2.3rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-4">{{ tidyText(block.text) }}</p>
        <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 28rem, 100vw" class="mt-7 lg:mt-auto w-full aspect-[4/3] object-cover rounded-[20px]" />
      </div>
      <dl class="content-start grid">
        <div v-for="(s, i) in items" :key="s.id" class="flex items-baseline justify-between gap-6 py-4" :class="i < items.length - 1 ? 'border-b border-line' : ''">
          <dt class="text-ink">{{ tidyText(s.name) }}<span v-if="s.priceNote" class="text-quiet text-[.95rem] block">{{ tidyText(s.priceNote) }}</span></dt>
          <dd v-if="s.price != null" class="num font-semibold text-ink whitespace-nowrap text-[1.1rem]">{{ formatPrice(s.price) }}&nbsp;{{ words.currency }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
