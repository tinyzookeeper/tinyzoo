<script setup lang="ts">
// Ciferník's price list: a dark panel, the prices in honey-coloured pills, a round photograph.
import type { Service } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'prices'>; first?: boolean; items: Service[] }>()
const words = useSiteWords()
</script>

<template>
  <section class="wrap pt-12 lg:pt-16">
    <div class="rounded-[28px] bg-ink text-paper p-6 sm:p-9 lg:p-12 grid gap-8 lg:grid-cols-[20rem_1fr] lg:gap-14">
      <div>
        <component :is="first ? 'h1' : 'h2'" class="!text-paper text-[2.1rem] lg:text-[2.6rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-4 text-paper/85">{{ tidyText(block.text) }}</p>
        <CmsImage v-if="block.roundImage ?? block.image" :media="(block.roundImage ?? block.image)!" sizes="13rem" class="mt-7 size-[11rem] lg:size-[13rem] rounded-full object-cover" />
      </div>
      <dl class="grid content-start">
        <div v-for="(s, i) in items" :key="s.id" class="flex items-center justify-between gap-5 py-3" :class="i < items.length - 1 ? 'border-b border-paper/20' : ''">
          <dt>{{ tidyText(s.name) }}<span v-if="s.priceNote" class="text-paper/70 text-[.95rem] block">{{ tidyText(s.priceNote) }}</span></dt>
          <dd v-if="s.price != null" class="rounded-full bg-sun text-ink px-3.5 py-1 font-display font-medium text-[1.1rem] num whitespace-nowrap">{{ formatPrice(s.price) }}&nbsp;{{ words.currency }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
