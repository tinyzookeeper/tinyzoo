<script setup lang="ts">
// Mistr's area: the text and a photograph on the left, the towns as a ruled list on the right.
import type { Town } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'area'>; first?: boolean; anchor?: string; items: Town[] }>()
const words = useSiteWords()
</script>

<template>
  <section :id="anchor" class="wrap py-20 md:py-28 scroll-mt-20">
    <div class="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
      <div class="lg:col-span-5">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="serif mt-5">{{ tidyText(block.text) }}</p>
        <figure v-if="block.image" class="mt-8">
          <div class="ph aspect-[3/2]"><CmsImage :media="block.image" sizes="(min-width: 1024px) 30rem, 100vw" /></div>
        </figure>
      </div>
      <div class="lg:col-span-7">
        <ul class="grid grid-cols-2 sm:grid-cols-3 gap-x-8 border-t border-line text-ink text-[1.0625rem] md:text-[1.1875rem] font-semibold tracking-[-0.01em]">
          <li v-for="t in items" :key="t.id" class="py-3.5 border-b border-line" :class="t.home ? 'flex items-baseline gap-2' : ''">{{ t.name }} <span v-if="t.home" class="text-[0.75rem] font-bold uppercase tracking-[0.06em] text-brand">{{ words.base }}</span></li>
        </ul>
        <p v-if="block.note" class="mt-6 text-[0.9375rem] text-quiet max-w-[36rem]">{{ tidyText(block.note) }}</p>
      </div>
    </div>
  </section>
</template>
