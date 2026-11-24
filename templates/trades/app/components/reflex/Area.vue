<script setup lang="ts">
// Reflex's area: the towns set as one big typographic paragraph, slashes between them and the
// home town on a block of the signal colour.
import type { Town } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'area'>; first?: boolean; anchor?: string; items: Town[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-16 md:pt-24 pb-20 md:pb-28 scroll-mt-0">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
      <div class="lg:col-span-8">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-4 text-[1.125rem] leading-[1.4] font-medium max-w-[30rem] lg:pb-2">{{ tidyText(block.text) }}</p>
    </div>
    <ul class="mt-10 md:mt-14 pt-6 md:pt-8 border-t-2 border-ink flex flex-wrap gap-x-[0.5em] gap-y-[0.12em] text-[1.9rem] sm:text-[2.75rem] lg:text-[4.1vw] font-black leading-[1.08] tracking-[-0.04em]">
      <li v-for="(t, i) in items" :key="t.id" :class="i < items.length - 1 ? 'flex gap-[0.5em]' : ''">
        <span v-if="t.home" class="bg-brand text-brand-ink px-[0.18em] -mx-[0.18em]">{{ t.name }}</span><template v-else>{{ t.name }}</template><span v-if="i < items.length - 1" class="font-normal opacity-40" aria-hidden="true">/</span>
      </li>
    </ul>
    <figure v-if="block.image" class="mt-8 md:mt-10"><div class="ph aspect-[4/3] sm:aspect-[2/1] lg:aspect-[21/9]"><CmsImage :media="block.image" sizes="100vw" /></div></figure>
    <p v-if="block.note" class="mt-8 text-[1.0625rem] font-medium max-w-[40rem]">{{ tidyText(block.note) }}</p>
  </section>
</template>
