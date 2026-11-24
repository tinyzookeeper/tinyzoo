<script setup lang="ts">
// Portál's services: a price list with dotted leaders, beside a photograph of the counter.
import type { Service } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; items: Service[] }>()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 py-20 md:py-28">
    <div class="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="caps text-brass">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.2rem] md:text-[3.1rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-md text-cream/80">{{ tidyText(block.text) }}</p>
        <div v-if="block.image" class="frame mt-9"><CmsImage :media="block.image" sizes="(min-width: 1024px) 34rem, 100vw" class="aspect-[4/3] object-cover" /></div>
      </div>
      <ul class="lg:col-span-7 lg:pt-3">
        <li v-for="(s, i) in items" :key="s.id" class="border-brass/35 py-6" :class="i === items.length - 1 ? 'border-y' : 'border-t'">
          <div class="flex items-baseline gap-3"><h3 class="text-[1.45rem] md:text-[1.6rem]">{{ s.name }}</h3><span class="leader" /><p class="fig whitespace-nowrap text-[1.2rem] text-brass">{{ s.price }}</p></div>
          <p v-if="s.text" class="mt-2 max-w-xl text-cream/80">{{ tidyText(s.text) }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
