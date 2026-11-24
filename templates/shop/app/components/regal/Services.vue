<script setup lang="ts">
// Regál's services: the counter photograph full-height on the left, the price list on a light
// tint on the right, the prices in the rail's colour in big condensed figures.
import type { Service } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
</script>

<template>
  <section :id="anchor" class="mt-10 scroll-mt-0 bg-tint md:mt-16">
    <div class="grid lg:grid-cols-12">
      <div class="relative min-h-[17rem] lg:col-span-5">
        <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 42vw, 100vw" class="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div class="px-5 py-14 md:px-10 md:py-20 lg:col-span-7 lg:pl-14 lg:pr-[max(2.5rem,calc((100vw-88rem)/2+2.5rem))]">
        <p v-if="block.eyebrow" class="cond text-[1.2rem] text-rail">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[2.3rem] font-bold tracking-[-0.035em] md:text-[3.5rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-xl">{{ tidyText(block.text) }}</p>
        <ul class="mt-9 border-t-[6px] border-ink">
          <li v-for="s in items" :key="s.id" class="grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-b border-ink/25 py-5">
            <h3 class="text-[1.3rem] !tracking-[-0.02em] md:text-[1.45rem]">{{ s.name }}</h3>
            <p class="num text-[2.2rem] text-rail">{{ s.price }}</p>
            <p v-if="s.text" class="col-span-2 mt-1 max-w-xl text-[0.97rem] opacity-80 md:col-span-1">{{ tidyText(s.text) }}</p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
